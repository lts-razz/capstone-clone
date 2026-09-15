import { getReservationDeadlineState, type ReservationDeadlineStateKind } from '../../lib/reservationValidity';
import { getTimeRangeDurationMinutes } from '../../lib/packageTimeOptions';

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending Payment',
  booked: 'Booked',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

const BOOKING_STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  booked: 'bg-green-100 text-green-700',
  rescheduled: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-slate-100 text-slate-700',
};

function statusLabel(status: string): string {
  return BOOKING_STATUS_LABELS[status] ?? status;
}

// ── NAVBAR KILL ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  const nav = document.getElementById('navbar');
  if (nav) { nav.style.cssText = 'display:none!important;height:0!important;overflow:hidden!important;position:static!important;'; }
  // Also remove the layout <main> padding that causes the top gap
  const layoutMain = document.querySelector('body > main') as HTMLElement;
  if (layoutMain) { layoutMain.style.paddingTop = '0'; }
});

// ── TAB SWITCHING ────────────────────────────────────────────────────────────
const tabTitles: Record<string, string> = {
  dashboard: 'Dashboard', bookings: 'Bookings', venues: 'Venues',
  packages: 'Packages', reviews: 'Reviews', users: 'Users', reports: 'Reports',
  'staff-management': 'Staff',
  calendar: 'Availability',
};

const adminTabButtons = Array.from(document.querySelectorAll<HTMLElement>('.nav-btn[data-tab]'));
const availableAdminTabs = adminTabButtons
  .map((button) => button.dataset.tab)
  .filter((id): id is string => Boolean(id && document.getElementById('tab-' + id)));

function getHashAdminTab(): string | null {
  const hash = window.location.hash.replace(/^#/, '').trim();
  if (!hash) return null;
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

function getInitialAdminTab(): string {
  const hashTab = getHashAdminTab();
  if (hashTab && availableAdminTabs.includes(hashTab)) return hashTab;
  const serverDefault = (window as any).__initialAdminTab ?? 'dashboard';
  return availableAdminTabs.includes(serverDefault) ? serverDefault : availableAdminTabs[0] ?? 'dashboard';
}

function syncAdminTabHash(id: string) {
  const nextHash = '#' + encodeURIComponent(id);
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, '', nextHash);
  }
}

function switchTab(id: string, updateUrl: boolean = true) {
  if (!availableAdminTabs.includes(id)) return;
  document.querySelectorAll('.tab-section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id)?.classList.remove('hidden');
  document.querySelectorAll<HTMLElement>('[data-tab="' + id + '"]').forEach(b => b.classList.add('active'));
  const t = document.getElementById('page-title');
  if (t) t.textContent = tabTitles[id] ?? id;
  if (updateUrl) syncAdminTabHash(id);
}

adminTabButtons.forEach(function(btn) {
  btn.addEventListener('click', function() { switchTab(btn.dataset.tab!); });
});
window.addEventListener('hashchange', function() {
  const hashTab = getHashAdminTab();
  if (hashTab) switchTab(hashTab, false);
});
switchTab(getInitialAdminTab());

// ── BOOKING FILTER & SEARCH ───────────────────────────────────────────────────
let activeBookingFilter = 'all';

function applyBookingTableControls() {
  const q = ((document.getElementById('bookingSearch') as HTMLInputElement | null)?.value ?? '').toLowerCase();
  const typeFilter = (document.getElementById('bookingTypeFilter') as HTMLSelectElement | null)?.value ?? 'all';
  const dateFrom = (document.getElementById('bookingDateFrom') as HTMLInputElement | null)?.value ?? '';
  const dateTo = (document.getElementById('bookingDateTo') as HTMLInputElement | null)?.value ?? '';
  const rows = Array.from(document.querySelectorAll<HTMLElement>('.booking-row'));
  let visibleCount = 0;
  rows.forEach(r => {
    const matchesFilter = activeBookingFilter === 'all' || r.dataset.status === activeBookingFilter;
    const matchesType = typeFilter === 'all' || r.dataset.bookingType === typeFilter;
    const eventDate = r.dataset.eventDate ?? '';
    const matchesFrom = !dateFrom || (!!eventDate && eventDate >= dateFrom);
    const matchesTo = !dateTo || (!!eventDate && eventDate <= dateTo);
    const matchesSearch = (r.dataset.search ?? '').toLowerCase().includes(q);
    const show = matchesFilter && matchesType && matchesFrom && matchesTo && matchesSearch;
    r.style.display = show ? '' : 'none';
    if (show) visibleCount++;
  });
  const empty = document.getElementById('bookingsEmptyState');
  if (empty) empty.classList.toggle('hidden', visibleCount > 0);
}

function sortBookingRows(sortBy: string) {
  const tbody = document.getElementById('bookingsTableBody');
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll<HTMLElement>('.booking-row'));
  const statusOrder: Record<string, number> = {
    pending: 0,
    booked: 1,
    rescheduled: 2,
    cancelled: 3,
    completed: 4,
  };
  rows.sort((a, b) => {
    if (sortBy === 'oldest') return Date.parse(a.dataset.created ?? '') - Date.parse(b.dataset.created ?? '');
    if (sortBy === 'event_asc') return Date.parse(a.dataset.eventDate ?? '') - Date.parse(b.dataset.eventDate ?? '');
    if (sortBy === 'event_desc') return Date.parse(b.dataset.eventDate ?? '') - Date.parse(a.dataset.eventDate ?? '');
    if (sortBy === 'status') {
      return (statusOrder[a.dataset.status ?? ''] ?? 99) - (statusOrder[b.dataset.status ?? ''] ?? 99)
        || (a.dataset.statusLabel ?? '').localeCompare(b.dataset.statusLabel ?? '');
    }
    return Date.parse(b.dataset.created ?? '') - Date.parse(a.dataset.created ?? '');
  });
  rows.forEach(row => tbody.appendChild(row));
  applyBookingTableControls();
}

document.querySelectorAll<HTMLElement>('.filter-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeBookingFilter = btn.dataset.filter ?? 'all';
    applyBookingTableControls();
  });
});
document.querySelector<HTMLElement>('[data-filter="all"]')?.classList.add('active');

document.getElementById('bookingSearch')?.addEventListener('input', applyBookingTableControls);
['bookingTypeFilter', 'bookingDateFrom', 'bookingDateTo'].forEach((id) => {
  document.getElementById(id)?.addEventListener('change', applyBookingTableControls);
});
document.getElementById('bookingSort')?.addEventListener('change', function(e) {
  sortBookingRows((e.target as HTMLSelectElement).value);
});
applyBookingTableControls();

// ── TOAST ─────────────────────────────────────────────────────────────────────
function toast(msg: string, ok: boolean = true) {
  const el = document.getElementById('toast')!;
  el.textContent = msg;
  el.style.background = ok ? 'var(--wb-action)' : 'var(--wb-danger-action)';
  el.classList.remove('hidden');
  setTimeout(function() { el.classList.add('hidden'); }, 3500);
}

// ── CUSTOM CONFIRM DIALOG ─────────────────────────────────────────────────────
type ConfirmOptions = {
  title: string;
  message: string;
  okLabel?: string;
  okColor?: string;
  icon?: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonRequiredMessage?: string;
};

function showConfirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise(function(resolve) {
    const dialog  = document.getElementById('confirmDialog')!;
    const icon    = document.getElementById('confirmDialogIcon')!;
    const title   = document.getElementById('confirmDialogTitle')!;
    const message = document.getElementById('confirmDialogMessage')!;
    const okBtn   = document.getElementById('confirmDialogOk') as HTMLButtonElement;
    const cancelBtn = document.getElementById('confirmDialogCancel')!;
    const reasonWrap = document.getElementById('confirmDialogReasonWrap')!;
    const reasonLabel = document.getElementById('confirmDialogReasonLabel')!;
    const reasonInput = document.getElementById('confirmDialogReason') as HTMLTextAreaElement;

    icon.textContent    = opts.icon ?? '❓';
    const confirmColor = opts.okColor ?? 'var(--wb-action-warm)';
    icon.style.background = `color-mix(in srgb, ${confirmColor} 18%, transparent)`;
    title.textContent   = opts.title;
    message.textContent = opts.message;
    okBtn.textContent   = opts.okLabel ?? 'Confirm';
    okBtn.style.background = confirmColor;
    reasonWrap.classList.add('hidden');
    reasonLabel.textContent = opts.reasonLabel ?? 'Reason';
    reasonInput.placeholder = opts.reasonPlaceholder ?? 'Enter reason';
    reasonInput.value = '';

    dialog.classList.remove('hidden');

    function cleanup(result: boolean) {
      dialog.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      dialog.removeEventListener('click', onBackdrop);
      resolve(result);
    }
    function onOk()      { cleanup(true);  }
    function onCancel()  { cleanup(false); }
    function onBackdrop(e: Event) { if (e.target === dialog) cleanup(false); }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    dialog.addEventListener('click', onBackdrop);
  });
}

// ── BOOKING ACTIONS ───────────────────────────────────────────────────────────
function showReasonConfirm(opts: ConfirmOptions): Promise<string | null> {
  return new Promise(function(resolve) {
    const dialog  = document.getElementById('confirmDialog')!;
    const icon    = document.getElementById('confirmDialogIcon')!;
    const title   = document.getElementById('confirmDialogTitle')!;
    const message = document.getElementById('confirmDialogMessage')!;
    const okBtn   = document.getElementById('confirmDialogOk') as HTMLButtonElement;
    const cancelBtn = document.getElementById('confirmDialogCancel')!;
    const reasonWrap = document.getElementById('confirmDialogReasonWrap')!;
    const reasonLabel = document.getElementById('confirmDialogReasonLabel')!;
    const reasonInput = document.getElementById('confirmDialogReason') as HTMLTextAreaElement;

    icon.textContent    = opts.icon ?? '!';
    const confirmColor = opts.okColor ?? 'var(--wb-action-warm)';
    icon.style.background = `color-mix(in srgb, ${confirmColor} 18%, transparent)`;
    title.textContent   = opts.title;
    message.textContent = opts.message;
    okBtn.textContent   = opts.okLabel ?? 'Confirm';
    okBtn.style.background = confirmColor;
    reasonLabel.textContent = opts.reasonLabel ?? 'Reason';
    reasonInput.placeholder = opts.reasonPlaceholder ?? 'Enter reason';
    reasonInput.value = '';
    okBtn.disabled = true;
    okBtn.style.opacity = '0.5';
    reasonWrap.classList.remove('hidden');

    dialog.classList.remove('hidden');
    setTimeout(function() { reasonInput.focus(); }, 0);

    function cleanup(result: string | null) {
      dialog.classList.add('hidden');
      reasonWrap.classList.add('hidden');
      okBtn.disabled = false;
      okBtn.style.opacity = '';
      reasonInput.removeEventListener('input', onReasonInput);
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      dialog.removeEventListener('click', onBackdrop);
      resolve(result);
    }
    function onOk() {
      const reason = reasonInput.value.trim();
      if (!reason) {
        toast(opts.reasonRequiredMessage ?? 'Override reason is required.', false);
        return;
      }
      cleanup(reason);
    }
    function onReasonInput() {
      const enabled = reasonInput.value.trim().length > 0;
      okBtn.disabled = !enabled;
      okBtn.style.opacity = enabled ? '' : '0.5';
    }
    function onCancel()  { cleanup(null); }
    function onBackdrop(e: Event) { if (e.target === dialog) cleanup(null); }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    dialog.addEventListener('click', onBackdrop);
    reasonInput.addEventListener('input', onReasonInput);
  });
}

async function updateBookingStatus(id: string, status: string, label: string) {
  const r = await fetch('/api/admin/update-booking-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookingId: id,
      status,
      confirmedSensitiveAction: status === 'cancelled' || status === 'completed',
    }),
  });
  const payload = await r.json().catch(() => ({}));
  if (r.ok) {
    toast(payload.warning ? `${label}, but email warning: ${payload.warning}` : `${label} saved ✓`);
    location.reload();
  } else {
    toast(payload.error ?? payload.message ?? `Failed to update booking to ${label}`, false);
  }
}

function reservationRemainingText(expiresAt: string | null, state: ReservationDeadlineStateKind): string {
  if (state === 'paid_secured') return 'Reservation secured';
  if (state === 'expired_cancelled') return 'Expired and cancelled';
  if (state === 'deadline_passed') return 'Deadline passed; cancellation pending';
  if (state === 'cancelled') return 'Cancelled';
  if (state === 'not_applicable') return 'Not applicable';
  if (!expiresAt) return 'Expiration not set';
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return 'Expired';
  const totalMinutes = Math.floor(remaining / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return days > 0
    ? `${days}d ${hours}h ${minutes}m remaining`
    : `${hours}h ${minutes}m remaining`;
}

function refreshReservationCountdowns() {
  document.querySelectorAll<HTMLElement>('.reservation-countdown').forEach((element) => {
    element.textContent = reservationRemainingText(
      element.dataset.reservationExpires || null,
      (element.dataset.reservationState || 'active_unpaid') as ReservationDeadlineStateKind,
    );
  });
}

refreshReservationCountdowns();
window.setInterval(refreshReservationCountdowns, 60000);

async function setBookingCompleted(id: string) {
  const ok = await showConfirm({
    title: 'Complete Booking',
    message: 'Mark this booking as completed? The client will be notified.',
    okLabel: 'Yes, Complete',
    okColor: '#5e5c60',
    icon: '✓',
  });
  if (!ok) return;
  await updateBookingStatus(id, 'completed', 'Completed');
}

async function confirmBooking(id: string) {
  const ok = await showConfirm({
    title: 'Book Booking',
    message: 'Are you sure you want to mark this booking as booked? The client will be notified.',
    okLabel: 'Yes, Book',
    okColor: '#157a45',
    icon: '✅',
  });
  if (!ok) return;
  const r = await fetch('/api/bookings/ConfirmBookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: id }) });
  const payload = await r.json().catch(() => ({}));
  if (r.ok) {
    toast(payload.warning ? `Booked, but email warning: ${payload.warning}` : 'Booking booked ✓');
    location.reload();
  } else {
    toast(payload.error ?? payload.message ?? 'Failed to book', false);
  }
}

async function cancelBooking(id: string) {
  const cancellationReason = await showReasonConfirm({
    title: 'Cancel Booking',
    message: 'Enter the cancellation reason. The next step will show the server-calculated refund outcome before cancellation.',
    okLabel: 'Review Refund',
    okColor: '#9a4a36',
    reasonLabel: 'Cancellation reason',
    reasonPlaceholder: 'Client request, duplicate booking, payment issue...',
    reasonRequiredMessage: 'Cancellation reason is required.',
    icon: '❌',
  });
  if (!cancellationReason) return;
  const preview = await fetch('/api/bookings/CancelBookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId: id, cancellationReason, previewOnly: true }),
  });
  const previewPayload = await preview.json().catch(() => ({}));
  if (!preview.ok) {
    toast(previewPayload.error ?? previewPayload.message ?? 'Could not calculate cancellation outcome', false);
    return;
  }
  const cancellation = previewPayload.cancellation ?? {};
  const confirmed = await showConfirm({
    title: 'Confirm Cancellation',
    message: `${cancellation.message ?? 'Cancel this booking?'} Refund status: ${formatAdminPaymentStatus(cancellation.refundStatus ?? 'not_required')}. Refund amount: ${formatMoney(cancellation.refundAmount ?? 0)}.`,
    okLabel: 'Yes, Cancel',
    okColor: '#9a4a36',
    icon: '!',
  });
  if (!confirmed) return;
  const r = await fetch('/api/bookings/CancelBookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: id, cancellationReason, confirmedSensitiveAction: true }) });
  const payload = await r.json().catch(() => ({}));
  if (r.ok) {
    toast(payload.warning ? `Cancelled, but email warning: ${payload.warning}` : 'Booking cancelled');
    location.reload();
  } else {
    toast(payload.error ?? payload.message ?? 'Failed to cancel', false);
  }
}

function parseAdminDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parts = value.split('-').map(Number);
  const parsed = new Date(parts[0], parts[1] - 1, parts[2]);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDaysForAdmin(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getAdminMinimumBookingDate(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return addDaysForAdmin(today, 7);
}

const adminMinimumBookingDate = getAdminMinimumBookingDate();
const adminMinimumBookingDateLabel = adminMinimumBookingDate.toLocaleDateString('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function getRescheduleOverrideState(): boolean {
  const start = parseAdminDateOnly((document.getElementById('rescheduleStart') as HTMLInputElement).value);
  const end = parseAdminDateOnly((document.getElementById('rescheduleEnd') as HTMLInputElement).value);
  const eventDate = parseAdminDateOnly((document.getElementById('rescheduleEventDate') as HTMLInputElement).value);
  return [start, end, eventDate].some((date) => date !== null && date < adminMinimumBookingDate);
}

function updateRescheduleOverrideWarning() {
  const warning = document.getElementById('rescheduleOverrideWarning');
  if (!warning) return;
  const requiresOverride = getRescheduleOverrideState();
  warning.classList.toggle('hidden', !requiresOverride);
  if (requiresOverride) {
    warning.textContent = `Bookings must be made at least 1 week in advance. The earliest allowed date is ${adminMinimumBookingDateLabel}. Admin confirmation is required.`;
  }
}

function openReschedule(id: string) {
  const booking = ((window as any).__allBookings ?? []).find((b: any) => b.id === id);
  (document.getElementById('rescheduleBookingId') as HTMLInputElement).value = id;
  (document.getElementById('rescheduleEventDate') as HTMLInputElement).value = booking?.event_date?.slice(0, 10) ?? '';
  (document.getElementById('rescheduleStart') as HTMLInputElement).value = booking?.start_date?.slice(0, 10) ?? '';
  (document.getElementById('rescheduleEnd') as HTMLInputElement).value = booking?.end_date?.slice(0, 10) ?? '';
  updateRescheduleOverrideWarning();
  document.getElementById('rescheduleModal')?.classList.remove('hidden');
}

function closeReschedule() {
  document.getElementById('rescheduleModal')?.classList.add('hidden');
}

async function submitReschedule() {
  const id    = (document.getElementById('rescheduleBookingId') as HTMLInputElement).value;
  const start = (document.getElementById('rescheduleStart') as HTMLInputElement).value;
  const end   = (document.getElementById('rescheduleEnd') as HTMLInputElement).value;
  const ev    = (document.getElementById('rescheduleEventDate') as HTMLInputElement).value;
  if (!start || !end) { toast('Dates required', false); return; }
  const startDate = parseAdminDateOnly(start);
  const endDate = parseAdminDateOnly(end);
  const eventDate = ev ? parseAdminDateOnly(ev) : null;

  if (!startDate || !endDate || (ev && !eventDate)) {
    toast('Please use valid reschedule dates.', false);
    return;
  }
  if (endDate <= startDate) {
    toast('New check-out must be after new check-in.', false);
    return;
  }
  if (eventDate && (eventDate < startDate || eventDate > endDate)) {
    toast('New event date must fall within the new check-in and check-out dates.', false);
    return;
  }

  const adminOverrideOneWeek = getRescheduleOverrideState();
  let overrideReason = '';
  if (adminOverrideOneWeek) {
    const reason = await showReasonConfirm({
      title: 'Confirm Date Override',
      message: `Bookings must be made at least 1 week in advance. The earliest allowed date is ${adminMinimumBookingDateLabel}. Enter the override reason before submitting.`,
      okLabel: 'Submit Override',
      okColor: 'var(--wb-action-warm)',
      icon: '!',
      reasonLabel: 'Override reason',
      reasonPlaceholder: 'Admin-approved urgent booking, special management approval...',
      reasonRequiredMessage: 'Override reason is required.',
    });
    if (!reason) return;
    overrideReason = reason;
  } else {
    const confirmed = await showConfirm({
      title: 'Confirm Reschedule',
      message: `Move this booking to ${formatAdminDateRange(start, end)}${ev ? ` with event date ${formatAdminDateRange(ev, ev)}` : ''}? Its status will change to Rescheduled and the client will be notified.`,
      okLabel: 'Yes, Reschedule',
      okColor: 'var(--wb-action-warm)',
      icon: '!',
    });
    if (!confirmed) return;
  }
  const r = await fetch('/api/admin/reschedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookingId: id,
      newStartDate: start,
      newEndDate: end,
      newEventDate: ev || null,
      adminOverrideOneWeek,
      overrideReason,
      confirmedSensitiveAction: true,
    }),
  });
  const payload = await r.json().catch(() => ({}));
  if (r.ok) {
    toast(payload.warning ? `Rescheduled, but email warning: ${payload.warning}` : 'Rescheduled ✓');
    closeReschedule();
    location.reload();
  } else {
    toast(payload.error ?? payload.message ?? 'Failed to reschedule', false);
  }
}

// ── VENUE MODAL ───────────────────────────────────────────────────────────────
function getPendingRescheduleRequestForBooking(bookingId: string) {
  const booking = ((window as any).__allBookings ?? []).find((b: any) => b.id === bookingId);
  return booking?.pendingRescheduleRequest ?? null;
}

function rescheduleRequestRequiresOverride(request: any): boolean {
  const start = parseAdminDateOnly(request?.requested_start_date ?? '');
  const eventDate = request?.requested_event_date ? parseAdminDateOnly(request.requested_event_date) : null;
  return [start, eventDate].some((date) => date !== null && date < adminMinimumBookingDate);
}

function formatRescheduleRequestSchedule(request: any): string {
  if (!request) return 'the requested schedule';
  const dateRange = formatAdminDateRange(request.requested_start_date, request.requested_end_date);
  return request.requested_event_date
    ? `${dateRange} with event date ${formatAdminDateRange(request.requested_event_date, request.requested_event_date)}`
    : dateRange;
}

async function approveRescheduleRequest(bookingId: string) {
  const request = getPendingRescheduleRequestForBooking(bookingId);
  if (!request) {
    toast('No pending reschedule request found for this booking.', false);
    return;
  }

  const adminOverrideOneWeek = rescheduleRequestRequiresOverride(request);
  let overrideReason = '';
  if (adminOverrideOneWeek) {
    if (!(window as any).__isAdmin) {
      toast('This request needs an admin date-rule override before approval.', false);
      return;
    }
    const reason = await showReasonConfirm({
      title: 'Approve Date Override',
      message: `This requested schedule is inside the one-week rule. The earliest allowed date is ${adminMinimumBookingDateLabel}. Enter the override reason before approval.`,
      okLabel: 'Approve Override',
      okColor: 'var(--wb-action-warm)',
      icon: '!',
      reasonLabel: 'Override reason',
      reasonPlaceholder: 'Admin-approved urgent reschedule...',
      reasonRequiredMessage: 'Override reason is required.',
    });
    if (!reason) return;
    overrideReason = reason;
  } else {
    const confirmed = await showConfirm({
      title: 'Approve Reschedule Request',
      message: `Move this booking to ${formatRescheduleRequestSchedule(request)}? The client will be notified.`,
      okLabel: 'Approve Request',
      okColor: 'var(--wb-action)',
      icon: '!',
    });
    if (!confirmed) return;
  }

  const r = await fetch('/api/admin/reschedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rescheduleRequestId: request.id,
      decision: 'approve',
      adminOverrideOneWeek,
      overrideReason,
      confirmedSensitiveAction: true,
    }),
  });
  const payload = await r.json().catch(() => ({}));
  if (r.ok) {
    toast(payload.warning ? `Request approved, but notification warning: ${payload.warning}` : 'Reschedule request approved');
    location.reload();
  } else {
    toast(payload.error ?? payload.message ?? 'Failed to approve request', false);
  }
}

async function rejectRescheduleRequest(bookingId: string) {
  const request = getPendingRescheduleRequestForBooking(bookingId);
  if (!request) {
    toast('No pending reschedule request found for this booking.', false);
    return;
  }
  const reason = await showReasonConfirm({
    title: 'Reject Reschedule Request',
    message: `Reject the request for ${formatRescheduleRequestSchedule(request)}?`,
    okLabel: 'Reject Request',
    okColor: 'var(--wb-danger-action)',
    icon: '!',
    reasonLabel: 'Reason',
    reasonPlaceholder: 'Dates unavailable, package timing conflict, customer follow-up needed...',
    reasonRequiredMessage: 'Rejection reason is required.',
  });
  if (!reason) return;

  const r = await fetch('/api/admin/reschedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rescheduleRequestId: request.id,
      decision: 'reject',
      reviewNote: reason,
      confirmedSensitiveAction: true,
    }),
  });
  const payload = await r.json().catch(() => ({}));
  if (r.ok) {
    toast('Reschedule request rejected');
    location.reload();
  } else {
    toast(payload.error ?? payload.message ?? 'Failed to reject request', false);
  }
}

['rescheduleStart', 'rescheduleEnd', 'rescheduleEventDate'].forEach(function(id) {
  document.getElementById(id)?.addEventListener('input', updateRescheduleOverrideWarning);
  document.getElementById(id)?.addEventListener('change', updateRescheduleOverrideWarning);
});

function showPackageVenueError(message: string) {
  const errorEl = document.getElementById('packageVenueError');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function clearPackageVenueError() {
  const errorEl = document.getElementById('packageVenueError');
  if (!errorEl) return;
  errorEl.textContent = '';
  errorEl.classList.add('hidden');
}

function openPackageVenueModal(packageId: string, packageName: string) {
  clearPackageVenueError();
  const form = document.getElementById('packageVenueForm') as HTMLFormElement | null;
  form?.reset();
  (document.getElementById('packageVenuePackageId') as HTMLInputElement).value = packageId;
  const packageNameEl = document.getElementById('packageVenueModalPackageName');
  if (packageNameEl) packageNameEl.textContent = packageName ? `For ${packageName}` : '';
  document.getElementById('packageVenueModal')?.classList.remove('hidden');
}

function closePackageVenueModal() {
  document.getElementById('packageVenueModal')?.classList.add('hidden');
}

async function submitPackageVenue(event?: SubmitEvent) {
  event?.preventDefault();
  clearPackageVenueError();

  const packageId = (document.getElementById('packageVenuePackageId') as HTMLInputElement).value;
  const nameInput = document.getElementById('packageVenueName') as HTMLInputElement;
  const descInput = document.getElementById('packageVenueDesc') as HTMLTextAreaElement;
  const capacityInput = document.getElementById('packageVenueCapacity') as HTMLInputElement;
  const imageInput = document.getElementById('packageVenueImage') as HTMLInputElement;
  const submitButton = document.getElementById('packageVenueSubmit') as HTMLButtonElement;
  const imageFile = imageInput.files?.[0];
  const capacity = Number(capacityInput.value);

  if (!packageId) return showPackageVenueError('Package is missing. Please refresh and try again.');
  if (!nameInput.value.trim()) return showPackageVenueError('Name is required.');
  if (!descInput.value.trim()) return showPackageVenueError('Description is required.');
  if (!Number.isInteger(capacity) || capacity <= 0) return showPackageVenueError('Capacity must be a positive whole number.');
  if (!imageFile) return showPackageVenueError('Image upload is required.');
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(imageFile.type.toLowerCase())) {
    return showPackageVenueError('Please upload a JPEG, PNG, WebP, or GIF image.');
  }
  if (imageFile.size > 5 * 1024 * 1024) return showPackageVenueError('Image must be 5 MB or smaller.');

  const formData = new FormData();
  formData.append('name', nameInput.value.trim());
  formData.append('description', descInput.value.trim());
  formData.append('capacity', String(capacity));
  formData.append('image', imageFile);

  submitButton.disabled = true;
  submitButton.textContent = 'Saving...';
  try {
    const response = await fetch('/api/admin/packages/' + encodeURIComponent(packageId) + '/venues', {
      method: 'POST',
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.error ?? payload.message ?? 'Could not add venue to package.';
      showPackageVenueError(message);
      toast(message, false);
      return;
    }

    toast(payload.message ?? 'Venue added to package successfully');
    closePackageVenueModal();
    location.reload();
  } catch (submitError) {
    const message = submitError instanceof Error ? submitError.message : 'Could not add venue to package.';
    showPackageVenueError(message);
    toast(message, false);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Save';
  }
}

async function deactivatePackageVenue(id: string, name: string) {
  const ok = await showConfirm({
    title: 'Deactivate Package Venue',
    message: `Deactivate ${name}? This space will no longer appear inside its package.`,
    okLabel: 'Deactivate',
    okColor: '#9a4a36',
    icon: 'PV',
  });
  if (!ok) return;

  const response = await fetch('/api/admin/package-venues/' + encodeURIComponent(id), {
    method: 'DELETE',
  });
  const payload = await response.json().catch(() => ({}));
  if (response.ok) {
    toast(payload.message ?? 'Package venue deactivated successfully');
    location.reload();
  } else {
    toast(payload.error ?? payload.message ?? 'Could not deactivate package venue', false);
  }
}

document.getElementById('packageVenueForm')?.addEventListener('submit', submitPackageVenue);

// ── PACKAGE MODAL ─────────────────────────────────────────────────────────────
function showVenueError(message: string) {
  const errorEl = document.getElementById('venueError');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function clearVenueError() {
  const errorEl = document.getElementById('venueError');
  if (!errorEl) return;
  errorEl.textContent = '';
  errorEl.classList.add('hidden');
}

function openVenueModal(jsonStr?: string) {
  clearVenueError();
  const form = document.getElementById('venueForm') as HTMLFormElement | null;
  form?.reset();
  const title = document.getElementById('venueModalTitle');
  const idInput = document.getElementById('venueId') as HTMLInputElement | null;
  const nameInput = document.getElementById('venueName') as HTMLInputElement | null;
  const descInput = document.getElementById('venueDesc') as HTMLTextAreaElement | null;
  const capacityInput = document.getElementById('venueCapacity') as HTMLInputElement | null;
  const priceInput = document.getElementById('venuePrice') as HTMLInputElement | null;
  const locationInput = document.getElementById('venueLocation') as HTMLInputElement | null;
  const imageInput = document.getElementById('venueImage') as HTMLInputElement | null;
  const imageUrlInput = document.getElementById('venueImageUrl') as HTMLInputElement | null;
  const imageHelp = document.getElementById('venueImageHelp');
  const submitButton = document.getElementById('venueSubmit') as HTMLButtonElement | null;

  if (jsonStr) {
    const venue = JSON.parse(jsonStr);
    if (title) title.textContent = 'Edit Venue';
    if (idInput) idInput.value = venue.id ?? '';
    if (nameInput) nameInput.value = venue.name ?? '';
    if (descInput) descInput.value = venue.description ?? '';
    if (capacityInput) capacityInput.value = venue.capacity ?? '';
    if (priceInput) priceInput.value = venue.price_per_night ?? '';
    if (locationInput) locationInput.value = venue.location ?? '';
    if (imageUrlInput) imageUrlInput.value = venue.image_url ?? '';
    if (imageInput) imageInput.required = false;
    if (imageHelp) imageHelp.textContent = 'Leave empty to keep the current image. JPEG, PNG, WebP, or GIF only, up to 5 MB.';
    if (submitButton) submitButton.textContent = 'Update';
  } else {
    if (title) title.textContent = 'Add Venue';
    if (idInput) idInput.value = '';
    if (imageUrlInput) imageUrlInput.value = '';
    if (imageInput) imageInput.required = true;
    if (imageHelp) imageHelp.textContent = 'JPEG, PNG, WebP, or GIF only, up to 5 MB.';
    if (submitButton) submitButton.textContent = 'Save';
  }
  document.getElementById('venueModal')?.classList.remove('hidden');
}

function closeVenueModal() {
  document.getElementById('venueModal')?.classList.add('hidden');
}

async function submitVenue(event?: SubmitEvent) {
  event?.preventDefault();
  clearVenueError();

  const nameInput = document.getElementById('venueName') as HTMLInputElement;
  const descInput = document.getElementById('venueDesc') as HTMLTextAreaElement;
  const idInput = document.getElementById('venueId') as HTMLInputElement | null;
  const capacityInput = document.getElementById('venueCapacity') as HTMLInputElement | null;
  const priceInput = document.getElementById('venuePrice') as HTMLInputElement | null;
  const locationInput = document.getElementById('venueLocation') as HTMLInputElement | null;
  const imageUrlInput = document.getElementById('venueImageUrl') as HTMLInputElement | null;
  const imageInput = document.getElementById('venueImage') as HTMLInputElement;
  const submitButton = document.getElementById('venueSubmit') as HTMLButtonElement;
  const id = idInput?.value ?? '';
  const imageFile = imageInput.files?.[0];
  const capacity = capacityInput?.value ? Number(capacityInput.value) : null;
  const price = priceInput?.value ? Number(priceInput.value) : null;

  if (!nameInput.value.trim()) return showVenueError('Name is required.');
  if (!descInput.value.trim()) return showVenueError('Description is required.');
  if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) return showVenueError('Capacity must be a positive whole number.');
  if (price !== null && (!Number.isFinite(price) || price <= 0)) return showVenueError('Venue price must be greater than 0.');
  if (!id && !imageFile) return showVenueError('Image upload is required.');
  if (imageFile && !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(imageFile.type.toLowerCase())) {
    return showVenueError('Please upload a JPEG, PNG, WebP, or GIF image.');
  }
  if (imageFile && imageFile.size > 5 * 1024 * 1024) return showVenueError('Image must be 5 MB or smaller.');

  const formData = new FormData();
  formData.append('name', nameInput.value.trim());
  formData.append('description', descInput.value.trim());
  if (capacity !== null) formData.append('capacity', String(capacity));
  if (price !== null) formData.append('price_per_night', String(price));
  if (locationInput?.value.trim()) formData.append('location', locationInput.value.trim());
  if (imageUrlInput?.value) formData.append('image_url', imageUrlInput.value);
  if (imageFile) formData.append('image', imageFile);

  submitButton.disabled = true;
  submitButton.textContent = id ? 'Updating...' : 'Saving...';
  try {
    const response = await fetch(id ? '/api/venues/' + encodeURIComponent(id) : '/api/venues', {
      method: id ? 'PUT' : 'POST',
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.error ?? payload.message ?? (id ? 'Could not update venue.' : 'Could not add venue.');
      showVenueError(message);
      toast(message, false);
      return;
    }

    toast(payload.message ?? (id ? 'Venue updated successfully' : 'Venue added successfully'));
    closeVenueModal();
    location.reload();
  } catch (submitError) {
    const message = submitError instanceof Error ? submitError.message : (id ? 'Could not update venue.' : 'Could not add venue.');
    showVenueError(message);
    toast(message, false);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = id ? 'Update' : 'Save';
  }
}

document.getElementById('venueForm')?.addEventListener('submit', submitVenue);

async function deleteVenue(id: string) {
  await toggleVenue(id, true);
}

async function toggleVenue(id: string, isActive: boolean, name = 'this venue') {
  const confirmed = await showConfirm({
    title: isActive ? 'Deactivate Venue' : 'Activate Venue',
    message: isActive
      ? `${name} will no longer be available for new package bookings. Existing bookings keep their stored venue details.`
      : `${name} can be assigned to packages and used for new bookings again.`,
    okLabel: isActive ? 'Deactivate' : 'Activate',
    okColor: isActive ? '#9a4a36' : '#157a45',
    icon: 'V',
  });
  if (!confirmed) return;

  const button = document.querySelector<HTMLButtonElement>(`[data-venue-toggle="${id}"]`);
  if (button) {
    button.disabled = true;
    button.textContent = isActive ? 'Deactivating...' : 'Activating...';
  }

  try {
    const response = await fetch('/api/venues/' + encodeURIComponent(id), isActive
      ? { method: 'DELETE' }
      : { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: true }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast(payload.error ?? payload.message ?? 'Could not update the venue status', false);
      return;
    }

    toast(payload.message ?? (isActive ? 'Venue deactivated successfully' : 'Venue activated successfully'));
    location.reload();
  } catch {
    toast('Could not update the venue. Check your connection and try again.', false);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = isActive ? 'Deactivate' : 'Activate';
    }
  }
}

function showPackageError(message: string) {
  const errorEl = document.getElementById('packageError');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function clearPackageError() {
  const errorEl = document.getElementById('packageError');
  if (!errorEl) return;
  errorEl.textContent = '';
  errorEl.classList.add('hidden');
}

function updatePackageTimeOptionFields() {
  const mode = (document.getElementById('packageTimeMode') as HTMLSelectElement).value;
  const usesRange = mode === 'fixed_range' || mode === 'range_duration';
  const usesDuration = mode === 'duration' || mode === 'range_duration';
  document.getElementById('packageFixedTimeFields')?.classList.toggle('hidden', !usesRange);
  document.getElementById('packageDurationFields')?.classList.toggle('hidden', !usesDuration);
}

function setPackageVenueSelections(venueIds: string[]) {
  const selected = new Set(venueIds ?? []);
  document.querySelectorAll<HTMLInputElement>('input[name="packageVenueIds"]').forEach(function(input) {
    input.checked = selected.has(input.value);
  });
}

function setPackageAllowedEventTypes(eventTypes: string[]) {
  const selected = new Set(eventTypes ?? []);
  document.querySelectorAll<HTMLInputElement>('input[name="packageAllowedEventTypes"]').forEach(function(input) {
    input.checked = selected.has(input.value);
  });
}

function setCheckedValues(inputName: string, values: string[]) {
  const selected = new Set(values ?? []);
  document.querySelectorAll<HTMLInputElement>(`input[name="${inputName}"]`).forEach(function(input) {
    input.checked = selected.has(input.value);
  });
}

function setPackageDefaultItems(
  selectionName: string,
  lockName: string,
  includeName: string,
  items: Array<{ key?: string; quantity?: number; locked?: boolean; included?: boolean }>,
) {
  const byKey = new Map((Array.isArray(items) ? items : []).map((item) => [item.key, item]));
  document.querySelectorAll<HTMLInputElement>(`input[name="${selectionName}"]`).forEach(function(input) {
    const item = byKey.get(input.value);
    input.checked = Boolean(item);
    const lock = document.querySelector<HTMLInputElement>(`input[name="${lockName}"][value="${input.value}"]`);
    if (lock) lock.checked = item?.locked === true;
    const included = document.querySelector<HTMLInputElement>(`input[name="${includeName}"][value="${input.value}"]`);
    if (included) included.checked = item?.included === true;
    const quantity = document.querySelector<HTMLInputElement>(`input[name="packageDefaultExtensionQuantity"][data-key="${input.value}"]`);
    if (quantity) quantity.value = String(Math.max(1, Number(item?.quantity) || 1));
  });
}

function setPackageLockouts(value: any) {
  const lockouts = value && typeof value === 'object' ? value : {};
  setCheckedValues('packageLockedSections', Array.isArray(lockouts.sections) ? lockouts.sections : []);
  setCheckedValues('packageDisabledRooms', Array.isArray(lockouts.rooms) ? lockouts.rooms : []);
  setCheckedValues('packageDisabledAddOns', Array.isArray(lockouts.addOns) ? lockouts.addOns : []);
  setCheckedValues('packageDisabledExtensions', Array.isArray(lockouts.extensions) ? lockouts.extensions : []);
  setCheckedValues('packageDisabledCorkage', Array.isArray(lockouts.corkage) ? lockouts.corkage : []);
  const disableRoomExtensionHours = document.getElementById('packageDisableRoomExtensionHours') as HTMLInputElement | null;
  if (disableRoomExtensionHours) disableRoomExtensionHours.checked = lockouts.roomExtensionHours === true;
}

function setPackageBookingOptions(value: any) {
  const options = value && typeof value === 'object' ? value : {};
  const multiDay = document.getElementById('packageDefaultMultiDay') as HTMLInputElement;
  const lockMultiDay = document.getElementById('packageLockMultiDay') as HTMLInputElement;
  const roomExtensionHours = document.getElementById('packageDefaultRoomExtensionHours') as HTMLInputElement;
  const lockRoomExtensionHours = document.getElementById('packageLockRoomExtensionHours') as HTMLInputElement;
  const includeRoomExtensionHours = document.getElementById('packageIncludeRoomExtensionHours') as HTMLInputElement;

  multiDay.checked = options.isMultiDay?.selected === true;
  lockMultiDay.checked = options.isMultiDay?.locked === true;
  roomExtensionHours.value = options.roomExtensionHours?.value > 0
    ? String(options.roomExtensionHours.value)
    : '0';
  lockRoomExtensionHours.checked = options.roomExtensionHours?.locked === true;
  includeRoomExtensionHours.checked = options.roomExtensionHours?.included === true;
  setPackageDefaultItems('packageDefaultRooms', 'packageLockedRooms', 'packageIncludedRooms', options.rooms ?? []);
  setPackageDefaultItems('packageDefaultAddOns', 'packageLockedAddOns', 'packageIncludedAddOns', options.addOns ?? []);
  setPackageDefaultItems('packageDefaultExtensions', 'packageLockedExtensions', 'packageIncludedExtensions', options.extensions ?? []);
  setPackageDefaultItems('packageDefaultCorkage', 'packageLockedCorkage', 'packageIncludedCorkage', options.corkage ?? []);
  setPackageLockouts(options.lockouts);
  syncPackageDefaultControls();
}

function syncPackageDefaultControls() {
  const roomHours = document.getElementById('packageDefaultRoomExtensionHours') as HTMLInputElement;
  const lockRoomHours = document.getElementById('packageLockRoomExtensionHours') as HTMLInputElement;
  const includeRoomHours = document.getElementById('packageIncludeRoomExtensionHours') as HTMLInputElement;
  const disableRoomHours = document.getElementById('packageDisableRoomExtensionHours') as HTMLInputElement;
  const roomsSectionDisabled = document.querySelector<HTMLInputElement>('input[name="packageLockedSections"][value="rooms"]')?.checked === true;
  const roomHoursDisabled = roomsSectionDisabled || disableRoomHours.checked;

  if (roomHoursDisabled) roomHours.value = '0';
  roomHours.disabled = roomHoursDisabled;
  disableRoomHours.disabled = roomsSectionDisabled;
  if (roomsSectionDisabled) disableRoomHours.checked = false;
  lockRoomHours.disabled = roomHoursDisabled || Number(roomHours.value) <= 0;
  if (lockRoomHours.disabled) lockRoomHours.checked = false;
  includeRoomHours.disabled = roomHoursDisabled || Number(roomHours.value) <= 0;
  if (includeRoomHours.disabled) includeRoomHours.checked = false;

  [
    ['rooms', 'packageDefaultRooms', 'packageLockedRooms', 'packageIncludedRooms', 'packageDisabledRooms'],
    ['addOns', 'packageDefaultAddOns', 'packageLockedAddOns', 'packageIncludedAddOns', 'packageDisabledAddOns'],
    ['extensions', 'packageDefaultExtensions', 'packageLockedExtensions', 'packageIncludedExtensions', 'packageDisabledExtensions'],
    ['corkage', 'packageDefaultCorkage', 'packageLockedCorkage', 'packageIncludedCorkage', 'packageDisabledCorkage'],
  ].forEach(function(names) {
    const sectionDisabled = document.querySelector<HTMLInputElement>(`input[name="packageLockedSections"][value="${names[0]}"]`)?.checked === true;
    document.querySelectorAll<HTMLInputElement>(`input[name="${names[1]}"]`).forEach(function(input) {
      const disable = document.querySelector<HTMLInputElement>(`input[name="${names[4]}"][value="${input.value}"]`);
      const choiceDisabled = sectionDisabled || disable?.checked === true;
      input.disabled = choiceDisabled;
      if (choiceDisabled) input.checked = false;
      if (disable) {
        disable.disabled = sectionDisabled;
        if (sectionDisabled) disable.checked = false;
      }
      const lock = document.querySelector<HTMLInputElement>(`input[name="${names[2]}"][value="${input.value}"]`);
      if (lock) {
        lock.disabled = choiceDisabled || !input.checked;
        if (!input.checked) lock.checked = false;
      }
      const included = document.querySelector<HTMLInputElement>(`input[name="${names[3]}"][value="${input.value}"]`);
      if (included) {
        included.disabled = choiceDisabled || !input.checked;
        if (!input.checked) included.checked = false;
      }
      const quantity = document.querySelector<HTMLInputElement>(`input[name="packageDefaultExtensionQuantity"][data-key="${input.value}"]`);
      if (quantity) quantity.disabled = choiceDisabled || !input.checked;
    });
  });
}

function collectPackageBookingOptions() {
  const selectedItems = (selectionName: string, lockName: string, includeName: string, withQuantity = false) =>
    Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${selectionName}"]:checked`))
    .filter((input) => !input.disabled)
    .map((input) => {
      const lock = document.querySelector<HTMLInputElement>(`input[name="${lockName}"][value="${input.value}"]`);
      const included = document.querySelector<HTMLInputElement>(`input[name="${includeName}"][value="${input.value}"]`);
      const quantity = document.querySelector<HTMLInputElement>(`input[name="packageDefaultExtensionQuantity"][data-key="${input.value}"]`);
      return {
        key: input.value,
        ...(withQuantity ? { quantity: Math.max(1, Math.floor(Number(quantity?.value) || 1)) } : {}),
        locked: lock?.checked === true,
        included: included?.checked === true,
      };
    });
  const multiDay = document.getElementById('packageDefaultMultiDay') as HTMLInputElement;
  const roomHours = Math.max(0, Math.floor(Number((document.getElementById('packageDefaultRoomExtensionHours') as HTMLInputElement).value) || 0));

  return {
    isMultiDay: {
      selected: multiDay.checked,
      locked: (document.getElementById('packageLockMultiDay') as HTMLInputElement).checked,
    },
    eventType: null,
    customEventType: null,
    rooms: selectedItems('packageDefaultRooms', 'packageLockedRooms', 'packageIncludedRooms'),
    roomExtensionHours: roomHours > 0 ? {
      value: roomHours,
      locked: (document.getElementById('packageLockRoomExtensionHours') as HTMLInputElement).checked,
      included: (document.getElementById('packageIncludeRoomExtensionHours') as HTMLInputElement).checked,
    } : null,
    addOns: selectedItems('packageDefaultAddOns', 'packageLockedAddOns', 'packageIncludedAddOns'),
    extensions: selectedItems('packageDefaultExtensions', 'packageLockedExtensions', 'packageIncludedExtensions', true),
    corkage: selectedItems('packageDefaultCorkage', 'packageLockedCorkage', 'packageIncludedCorkage'),
    lockouts: {
      sections: Array.from(document.querySelectorAll<HTMLInputElement>('input[name="packageLockedSections"]:checked')).map((input) => input.value),
      eventTypes: [],
      rooms: Array.from(document.querySelectorAll<HTMLInputElement>('input[name="packageDisabledRooms"]:checked')).map((input) => input.value),
      roomExtensionHours: (document.getElementById('packageDisableRoomExtensionHours') as HTMLInputElement).checked,
      addOns: Array.from(document.querySelectorAll<HTMLInputElement>('input[name="packageDisabledAddOns"]:checked')).map((input) => input.value),
      extensions: Array.from(document.querySelectorAll<HTMLInputElement>('input[name="packageDisabledExtensions"]:checked')).map((input) => input.value),
      corkage: Array.from(document.querySelectorAll<HTMLInputElement>('input[name="packageDisabledCorkage"]:checked')).map((input) => input.value),
    },
  };
}

function collectPackageAllowedEventTypes() {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[name="packageAllowedEventTypes"]:checked'))
    .map((input) => input.value);
}

function parsePackageInclusions(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function setPackageThumbnailPreview(url: string) {
  const preview = document.getElementById('packageThumbnailPreview') as HTMLImageElement;
  preview.src = url || '';
  preview.classList.toggle('hidden', !url);
}

function getPackageSubmitButtons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('#packageSubmit, #packageSubmitEnd'));
}

function setPackageSubmitButtons(label: string, disabled = false) {
  getPackageSubmitButtons().forEach((button) => {
    button.disabled = disabled;
    button.textContent = label;
  });
}

function openPackageModal(jsonStr?: string) {
  const title = document.getElementById('packageModalTitle')!;
  const status = document.getElementById('packageModalStatus');
  clearPackageError();
  setPackageSubmitButtons(jsonStr ? 'UPDATE PACKAGE' : 'SAVE PACKAGE');
  (document.getElementById('packageThumbnail') as HTMLInputElement).value = '';
  if (jsonStr) {
    const p = JSON.parse(jsonStr);
    (document.getElementById('packageId') as HTMLInputElement).value = p.id;
    (document.getElementById('packageName') as HTMLInputElement).value = p.name ?? '';
    (document.getElementById('packageDesc') as HTMLTextAreaElement).value = p.description ?? '';
    (document.getElementById('packagePrice') as HTMLInputElement).value = p.price ?? '';
    (document.getElementById('packageMinPax') as HTMLInputElement).value = p.min_pax ?? '';
    (document.getElementById('packageMaxPax') as HTMLInputElement).value = p.max_pax ?? '';
    (document.getElementById('packageInclusions') as HTMLTextAreaElement).value = p.inclusions ?? '';
    (document.getElementById('packageThumbnailUrl') as HTMLInputElement).value = p.thumbnail_url ?? '';
    setPackageThumbnailPreview(p.thumbnail_url ?? '');
    setPackageVenueSelections(p.venue_ids ?? (p.venue_id ? [p.venue_id] : []));
    const timeOptions = p.time_options ?? {};
    const mode = ['fixed_range', 'duration', 'range_duration'].includes(timeOptions.mode)
      ? timeOptions.mode
      : 'fixed_range';
    (document.getElementById('packageTimeMode') as HTMLSelectElement).value = mode;
    (document.getElementById('packageFromTime') as HTMLInputElement).value = timeOptions.from_time ?? '';
    (document.getElementById('packageToTime') as HTMLInputElement).value = timeOptions.to_time ?? '';
    (document.getElementById('packageDurationHours') as HTMLInputElement).value = timeOptions.hours ?? '';
    setPackageAllowedEventTypes(Array.isArray(p.rules?.event_types) ? p.rules.event_types : []);
    setPackageBookingOptions(p.booking_options);
    title.textContent = 'Edit Package';
    if (status) {
      status.textContent = p.is_active === false ? 'Inactive package' : 'Active package';
      status.classList.toggle('package-modal-status--inactive', p.is_active === false);
    }
  } else {
    ['packageId','packageName','packageDesc','packagePrice','packageMinPax','packageMaxPax','packageInclusions','packageThumbnailUrl','packageFromTime','packageToTime','packageDurationHours'].forEach(function(i) {
      const e = document.getElementById(i) as HTMLInputElement;
      if (e) e.value = '';
    });
    (document.getElementById('packageTimeMode') as HTMLSelectElement).value = 'fixed_range';
    setPackageVenueSelections([]);
    setPackageAllowedEventTypes([]);
    setPackageBookingOptions(null);
    setPackageThumbnailPreview('');
    title.textContent = 'Add Package';
    if (status) {
      status.textContent = 'New package';
      status.classList.remove('package-modal-status--inactive');
    }
  }
  updatePackageTimeOptionFields();
  const modalBody = document.querySelector<HTMLElement>('#packageModal .package-modal-body');
  if (modalBody) modalBody.scrollTop = 0;
  document.getElementById('packageModal')?.classList.remove('hidden');
}

function closePackageModal() { document.getElementById('packageModal')?.classList.add('hidden'); }

async function submitPackage() {
  const id = (document.getElementById('packageId') as HTMLInputElement).value;
  const name = (document.getElementById('packageName') as HTMLInputElement).value.trim();
  const basePrice = Number((document.getElementById('packagePrice') as HTMLInputElement).value);
  const minPax = parseInt((document.getElementById('packageMinPax') as HTMLInputElement).value) || null;
  const maxPax = parseInt((document.getElementById('packageMaxPax') as HTMLInputElement).value) || null;
  const mode = (document.getElementById('packageTimeMode') as HTMLSelectElement).value;
  const thumbnailFile = (document.getElementById('packageThumbnail') as HTMLInputElement).files?.[0];
  clearPackageError();

  if (!name) return showPackageError('Package name is required.');
  if (!Number.isFinite(basePrice) || basePrice < 0) return showPackageError('Enter a valid package base price.');
  if (minPax && maxPax && minPax > maxPax) return showPackageError('Minimum guests must be less than or equal to maximum guests.');

  let timeOptions: { mode: 'fixed_range' | 'duration' | 'range_duration'; from_time?: string; to_time?: string; hours?: number };
  const usesRange = mode === 'fixed_range' || mode === 'range_duration';
  const usesDuration = mode === 'duration' || mode === 'range_duration';
  const fromTime = (document.getElementById('packageFromTime') as HTMLInputElement).value;
  const toTime = (document.getElementById('packageToTime') as HTMLInputElement).value;
  const hours = Number((document.getElementById('packageDurationHours') as HTMLInputElement).value);

  if (usesRange) {
    if (!fromTime || !toTime) return showPackageError('Choose both the earliest start and latest end time.');
    if (fromTime === toTime) return showPackageError('The package start and end times must be different.');
  }
  if (usesDuration) {
    if (!Number.isFinite(hours) || hours < 0.5 || hours > 168 || !Number.isInteger(hours * 2)) {
      return showPackageError('Enter a duration from 0.5 to 168 hours in 30-minute increments.');
    }
  }
  if (mode === 'range_duration') {
    const rangeMinutes = getTimeRangeDurationMinutes(fromTime, toTime);
    if (rangeMinutes === null || hours * 60 > rangeMinutes) {
      return showPackageError('The required duration must fit inside the configured time range.');
    }
    timeOptions = { mode: 'range_duration', from_time: fromTime, to_time: toTime, hours };
  } else if (mode === 'duration') {
    timeOptions = { mode: 'duration', hours };
  } else {
    timeOptions = { mode: 'fixed_range', from_time: fromTime, to_time: toTime };
  }

  if (thumbnailFile) {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(thumbnailFile.type.toLowerCase())) {
      return showPackageError('Please upload a JPEG, PNG, WebP, or GIF thumbnail.');
    }
    if (thumbnailFile.size > 5 * 1024 * 1024) return showPackageError('Thumbnail must be 5 MB or smaller.');
  }

  setPackageSubmitButtons(thumbnailFile ? 'UPLOADING...' : 'SAVING...', true);
  let thumbnailUrl = (document.getElementById('packageThumbnailUrl') as HTMLInputElement).value || null;

  try {
    if (thumbnailFile) {
      const uploadData = new FormData();
      uploadData.append('image', thumbnailFile);
      const uploadResponse = await fetch('/api/packages/thumbnail', { method: 'POST', body: uploadData });
      const uploadPayload = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok) throw new Error(uploadPayload.error ?? uploadPayload.message ?? 'Thumbnail upload failed.');
      thumbnailUrl = uploadPayload.thumbnailUrl;
      setPackageSubmitButtons('SAVING...', true);
    }

    const selectedVenueIds = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="packageVenueIds"]:checked'))
      .map((input) => input.value);
    const venueIds = [...new Set(selectedVenueIds)];
    if (venueIds.length !== selectedVenueIds.length) {
      throw new Error('A venue can only be assigned to a package once.');
    }
    const inclusions = (document.getElementById('packageInclusions') as HTMLTextAreaElement).value || '';
    const allowedEventTypes = collectPackageAllowedEventTypes();
    const body = {
      name,
      description: (document.getElementById('packageDesc') as HTMLTextAreaElement).value || null,
      venue_ids: venueIds,
      price: basePrice,
      min_pax: minPax,
      max_pax: maxPax,
      inclusions: inclusions || null,
      included_facilities: parsePackageInclusions(inclusions),
      rules: allowedEventTypes.length > 0 ? { event_types: allowedEventTypes } : null,
      time_options: timeOptions,
      thumbnail_url: thumbnailUrl,
      booking_options: collectPackageBookingOptions(),
    };
    const response = await fetch(id ? '/api/packages/' + id : '/api/packages', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? payload.message ?? 'Failed to save package.');
    toast(id ? 'Package updated ✓' : 'Package created ✓');
    closePackageModal();
    location.reload();
  } catch (submitError) {
    const message = submitError instanceof Error ? submitError.message : 'Failed to save package.';
    showPackageError(message);
    toast(message, false);
  } finally {
    setPackageSubmitButtons(id ? 'UPDATE PACKAGE' : 'SAVE PACKAGE');
  }
}

document.getElementById('packageTimeMode')?.addEventListener('change', updatePackageTimeOptionFields);
document.querySelector('.package-booking-defaults')?.addEventListener('change', syncPackageDefaultControls);
document.getElementById('packageDefaultRoomExtensionHours')?.addEventListener('input', syncPackageDefaultControls);

async function togglePackage(id: string, isActive: boolean) {
  const ok = await showConfirm({
    title: isActive ? 'Deactivate Package' : 'Activate Package',
    message: isActive ? 'This package will no longer be available to clients.' : 'This package will be visible and bookable again.',
    okLabel: isActive ? 'Deactivate' : 'Activate',
    okColor: isActive ? '#9a4a36' : '#157a45',
    icon: isActive ? '📦' : '📦',
  });
  if (!ok) return;
  const url = '/api/packages/' + encodeURIComponent(id);
  const r = await fetch(url, isActive
    ? { method: 'DELETE' }
    : { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: true }) });
  const payload = await r.json().catch(() => ({}));
  if (r.ok) {
    toast(payload.message ?? (isActive ? 'Package deactivated successfully' : 'Package activated successfully'));
    location.reload();
  } else {
    toast(payload.error ?? 'Could not update package status', false);
  }
}

async function deletePackage(id: string, name: string) {
  const ok = await showConfirm({
    title: 'Deactivate Package',
    message: `${name} will be hidden from customers. Existing bookings keep their stored package details.`,
    okLabel: 'Deactivate',
    okColor: '#9a4a36',
    icon: 'PK',
  });
  if (!ok) return;

  const response = await fetch('/api/packages/' + encodeURIComponent(id), {
    method: 'DELETE',
  });
  const payload = await response.json().catch(() => ({}));
  if (response.ok) {
    toast(payload.message ?? 'Package deactivated successfully');
    location.reload();
  } else {
    toast(payload.error ?? payload.message ?? 'Could not deactivate package', false);
  }
}

// ── USER MANAGEMENT ───────────────────────────────────────────────────────────
async function promoteUser(id: string) {
  const ok = await showConfirm({
    title: 'Promote to Admin',
    message: 'This user will gain full admin access to the panel. Are you sure?',
    okLabel: 'Yes, Promote',
    okColor: 'var(--wb-action-warm)',
    icon: '👑',
  });
  if (!ok) return;
  const r = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: id, action: 'promote' }) });
  if (r.ok) { toast('Promoted to admin ✓'); location.reload(); } else { toast('Failed to promote', false); }
}

async function demoteUser(id: string) {
  const ok = await showConfirm({
    title: 'Demote to Customer',
    message: 'This admin will lose all admin privileges. Are you sure?',
    okLabel: 'Yes, Demote',
    okColor: '#9a4a36',
    icon: '⬇️',
  });
  if (!ok) return;
  const r = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: id, action: 'demote' }) });
  if (r.ok) { toast('Demoted to customer ✓'); location.reload(); } else { toast('Failed to demote', false); }
}

// ── MODAL BACKDROP CLOSE ──────────────────────────────────────────────────────
['rescheduleModal', 'venueModal', 'staffModal'].forEach(function(id) {
  document.getElementById(id)?.addEventListener('click', function(e) {
    if (e.target === document.getElementById(id)) document.getElementById(id)?.classList.add('hidden');
  });
});

// ── BOOKING DETAILS MODAL (Fig 19) ───────────────────────────────────────────
async function promoteStaff(id: string) {
  const ok = await showConfirm({
    title: 'Promote to Staff',
    message: 'This user will be able to manage bookings, schedules, reschedules, status updates, and booking payments.',
    okLabel: 'Yes, Promote',
    okColor: '#157a45',
    icon: 'ST',
  });
  if (!ok) return;
  const r = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: id, action: 'promote_staff' }) });
  if (r.ok) { toast('Promoted to staff'); location.reload(); } else { toast('Failed to promote staff', false); }
}

async function demoteStaff(id: string) {
  const ok = await showConfirm({
    title: 'Demote Staff',
    message: 'This staff member will lose staff dashboard access and return to a customer account.',
    okLabel: 'Yes, Demote',
    okColor: '#9a4a36',
    icon: 'ST',
  });
  if (!ok) return;
  const r = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: id, action: 'demote_staff' }) });
  if (r.ok) { toast('Staff demoted to customer'); location.reload(); } else { toast('Failed to demote staff', false); }
}

function setText(id: string, val: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function toggleEl(id: string, show: boolean) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? '' : 'none';
}

function addActionBtn(container: HTMLElement, label: string, color: string, fn: () => void, outline: boolean = false) {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.className = 'px-4 py-2 rounded-lg text-sm font-bold transition hover:opacity-80';
  btn.style.cssText = outline
    ? 'border:2px solid ' + color + ';color:' + color + ';background:white;'
    : 'background:' + color + ';color:white;';
  btn.addEventListener('click', fn);
  container.appendChild(btn);
}

function openStaffModal(staff?: any) {
  const editing = Boolean(staff?.id);
  (document.getElementById('staffId') as HTMLInputElement).value = staff?.id ?? '';
  (document.getElementById('staffFirstName') as HTMLInputElement).value = staff?.first_name ?? '';
  (document.getElementById('staffLastName') as HTMLInputElement).value = staff?.last_name ?? '';
  const email = document.getElementById('staffEmail') as HTMLInputElement;
  email.value = staff?.email ?? '';
  email.disabled = editing;
  email.required = !editing;
  (document.getElementById('staffPhone') as HTMLInputElement).value = staff?.phone ?? '';
  (document.getElementById('staffPosition') as HTMLInputElement).value = staff?.position ?? 'Staff';
  const password = document.getElementById('staffPassword') as HTMLInputElement;
  password.value = '';
  password.required = !editing;
  document.getElementById('staffPasswordField')?.classList.toggle('hidden', editing);
  document.getElementById('staffFormError')?.classList.add('hidden');
  document.getElementById('staffModalTitle')!.textContent = editing ? 'Edit staff details' : 'Add staff account';
  document.getElementById('staffSubmitButton')!.textContent = editing ? 'Save changes' : 'Create account';
  document.getElementById('staffModal')?.classList.remove('hidden');
}

function closeStaffModal() { document.getElementById('staffModal')?.classList.add('hidden'); }

async function staffRequest(payload: Record<string, unknown>) {
  const response = await fetch('/api/admin/staff', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Staff account request failed');
  return result;
}

document.getElementById('staffForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const staffId = (document.getElementById('staffId') as HTMLInputElement).value;
  const submit = document.getElementById('staffSubmitButton') as HTMLButtonElement;
  const errorBox = document.getElementById('staffFormError')!;
  submit.disabled = true;
  errorBox.classList.add('hidden');
  try {
    await staffRequest({
      action: staffId ? 'update' : 'create', staffId: staffId || undefined,
      email: (document.getElementById('staffEmail') as HTMLInputElement).value,
      password: (document.getElementById('staffPassword') as HTMLInputElement).value,
      firstName: (document.getElementById('staffFirstName') as HTMLInputElement).value,
      lastName: (document.getElementById('staffLastName') as HTMLInputElement).value,
      phone: (document.getElementById('staffPhone') as HTMLInputElement).value,
      position: (document.getElementById('staffPosition') as HTMLInputElement).value,
    });
    toast(staffId ? 'Staff details updated' : 'Staff account created');
    location.reload();
  } catch (err) {
    errorBox.textContent = err instanceof Error ? err.message : 'Staff account request failed';
    errorBox.classList.remove('hidden');
  } finally { submit.disabled = false; }
});

async function setStaffStatus(staffId: string, action: 'activate' | 'deactivate') {
  const confirmed = await showConfirm({
    title: action === 'activate' ? 'Activate staff account' : 'Deactivate staff account',
    message: action === 'activate' ? 'This staff member will regain access to the staff booking workspace.' : 'This staff member will immediately lose staff workspace access.',
    okLabel: action === 'activate' ? 'Activate' : 'Deactivate', okColor: action === 'activate' ? '#157a45' : '#9a4a36', icon: 'ST',
  });
  if (!confirmed) return;
  try { await staffRequest({ action, staffId }); toast(`Staff account ${action}d`); location.reload(); }
  catch (err) { toast(err instanceof Error ? err.message : 'Could not update staff access', false); }
}

function canTransitionBookingStatus(fromStatus: string, toStatus: string): boolean {
  const transitions = (window as any).__bookingStatusTransitions ?? {};
  return Array.isArray(transitions[fromStatus]) && transitions[fromStatus].includes(toStatus);
}

async function manuallyReopenCancelledBooking(id: string, expired: boolean) {
  const overrideReason = await showReasonConfirm({
    title: expired ? 'Reopen expired reservation' : 'Reopen cancelled reservation',
    message: expired
      ? 'Warning: this unpaid reservation expired and was cancelled by the system. Verify the required payment and availability, then enter the admin override reason.'
      : 'Warning: this reservation was cancelled. Verify the required payment and availability, then enter the admin override reason.',
    okLabel: 'Confirm manual override',
    okColor: '#9a4a36',
    icon: '!',
    reasonLabel: 'Override reason',
    reasonPlaceholder: 'Payment verified manually, management approval, client settled balance...',
    reasonRequiredMessage: 'Override reason is required.',
  });
  if (!overrideReason) return;

  const response = await fetch('/api/admin/update-booking-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId: id, status: 'booked', manualOverride: true, overrideReason, confirmedSensitiveAction: true }),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.ok) {
    toast(payload.warning ? `Booking reopened, but notification warning: ${payload.warning}` : 'Booking reopened by manual override');
    location.reload();
  } else {
    toast(payload.error ?? payload.message ?? 'Could not reopen booking', false);
  }
}

function formatMoney(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  return Number.isFinite(amount) ? '₱' + amount.toLocaleString() : '—';
}

function normalizeBookingItems(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && Array.isArray(value.included)) return value.included;
  return value === null || value === undefined || value === '' ? [] : [value];
}

function readableBookingKey(value: unknown): string {
  return String(value ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function renderBookingItems(id: string, value: any, emptyMessage: string) {
  const container = document.getElementById(id);
  if (!container) return;
  container.replaceChildren();
  const items = normalizeBookingItems(value);
  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'booking-detail-empty';
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'booking-detail-list';
  items.forEach((item: any) => {
    const row = document.createElement('li');
    const label = document.createElement('span');
    const itemLabel = typeof item === 'string' || typeof item === 'number'
      ? String(item)
      : item?.label ?? item?.name ?? item?.title ?? readableBookingKey(item?.key) ?? 'Selection';
    label.textContent = itemLabel || 'Selection';
    row.appendChild(label);

    if (item && typeof item === 'object') {
      const details: string[] = [];
      if (item.group) details.push(String(item.group));
      const hours = Number(item.hours ?? 0);
      const quantity = Number(item.quantity ?? 0);
      if (hours > 0) details.push(`${hours.toLocaleString()} ${hours === 1 ? 'hour' : 'hours'}`);
      else if (quantity > 1) details.push(`Qty ${quantity.toLocaleString()}`);
      if (item.included === true) details.push('Included in package');
      const amount = Number(item.amount);
      if (item.amount !== null && item.amount !== undefined && Number.isFinite(amount) && amount > 0) {
        details.push(formatMoney(amount));
      }
      if (details.length > 0) {
        const meta = document.createElement('small');
        meta.textContent = details.join(' · ');
        row.appendChild(meta);
      }
    }
    list.appendChild(row);
  });
  container.appendChild(list);
}

function combinedBookingItems(...values: any[]): any[] {
  return values.flatMap(normalizeBookingItems);
}

function formatEstimateAmount(value: unknown): string {
  return value === null || value === undefined || value === '' ? 'Not recorded' : formatMoney(value);
}

function isCustomBooking(booking: any): boolean {
  return booking.package_type === 'custom-booking' || booking.additionals?.customBooking === true;
}

function customQuotationFinalized(booking: any): boolean {
  return !isCustomBooking(booking)
    || (booking.quotation_status === 'finalized'
      && Number(booking.total_price) > 0
      && Number(booking.minimum_payment_amount) > 0);
}

function formatAdminPaymentStatus(value: unknown): string {
  const status = String(value ?? 'unpaid');
  return readableBookingKey(status);
}

function formatAssignedVenueNames(booking: any): string {
  if (Array.isArray(booking.assignedVenueNames) && booking.assignedVenueNames.length > 0) {
    return booking.assignedVenueNames.join(', ');
  }
  return booking.venueName && booking.venueName !== '—' ? booking.venueName : 'No venue recorded';
}

function parseBookingEndMsForAction(booking: any): number | null {
  if (booking.end_datetime) {
    const parsed = Date.parse(booking.end_datetime);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (!booking.end_date) return null;
  const parsed = Date.parse(`${booking.end_date}T23:59:59+08:00`);
  return Number.isFinite(parsed) ? parsed : null;
}

function bookingHasEndedForAction(booking: any): boolean {
  const endMs = parseBookingEndMsForAction(booking);
  return endMs !== null && Date.now() >= endMs;
}

function getBookingNextActionLabel(booking: any): string {
  if (booking.pendingRescheduleRequest) return 'Review Reschedule';
  if (booking.status === 'pending' && isCustomBooking(booking) && !customQuotationFinalized(booking)) return 'Finalize Quotation';
  if (booking.status === 'pending') return 'Await Payment';
  if ((booking.status === 'booked' || booking.status === 'rescheduled') && bookingHasEndedForAction(booking)) return 'Complete Event';
  if (booking.status === 'cancelled' && booking.payment?.refund_status === 'pending' && Number(booking.payment?.refund_amount ?? 0) > 0) return 'Process Refund';
  if (booking.status === 'booked' || booking.status === 'rescheduled') return 'Monitor Event';
  if (booking.status === 'completed') return 'Completed';
  if (booking.status === 'cancelled') return 'Cancelled';
  return 'Review Booking';
}

function updatePaymentCalculations() {
  const total = Number((document.getElementById('paymentTotal') as HTMLInputElement).value || 0);
  const paid = Number((document.getElementById('paymentAmountPaid') as HTMLInputElement).value || 0);
  (document.getElementById('paymentMinimum') as HTMLInputElement).value = formatMoney(total * 0.5);
  (document.getElementById('paymentBalance') as HTMLInputElement).value = formatMoney(Math.max(total - paid, 0));
}

function openPaymentModal(jsonStr: string) {
  const booking = JSON.parse(jsonStr);
  const payment = booking.payment ?? {};
  const customBooking = isCustomBooking(booking);
  const quoteFinalized = customQuotationFinalized(booking);
  const roughEstimate = booking.estimate_summary?.roughAdditionsTotal ?? booking.additionals?.roughAdditionsTotal;
  const reservation = getReservationDeadlineState(booking);
  const badge = document.getElementById('paymentReservationBadge')!;
  badge.textContent = reservation.label;
  badge.className = `reservation-badge ${reservation.className}`;
  setText('paymentReservationRemaining', reservationRemainingText(booking.reservation_expires_at ?? null, reservation.kind));
  setText(
    'paymentReservationExpiration',
    booking.reservation_expires_at
      ? `Reservation expires ${new Date(booking.reservation_expires_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' } as any)}`
      : 'Reservation expiration is not set',
  );
  document.getElementById('paymentReservationNotice')?.classList.toggle('reservation-warning-cell', reservation.warning);
  (document.getElementById('paymentBookingId') as HTMLInputElement).value = booking.id;
  setText('paymentGuest', booking.full_name ?? 'Booking payment');
  setText('paymentModalTitle', customBooking && !quoteFinalized ? 'Finalize Custom Quotation' : customBooking ? 'Edit Custom Quotation / Payment' : 'Record Payment');
  setText('paymentTotalLabel', customBooking ? 'Final Payable Amount *' : 'Total Booking Amount *');
  setText(
    'customPricingEstimate',
    customBooking && !quoteFinalized
      ? `Submitted rough additions estimate: ${formatEstimateAmount(roughEstimate)}. Saving the final payable amount starts the 48-hour payment window; it does not mark the booking as booked.`
      : `Submitted rough additions estimate: ${formatEstimateAmount(roughEstimate)}. This is a guide only, not the final payable total.`,
  );
  document.getElementById('customPricingNotice')?.classList.toggle('hidden', !customBooking);
  const displayedTotal = customBooking && Number(booking.total_price) > 0
    ? booking.total_price
    : payment.total_booking_amount ?? booking.total_price ?? 0;
  (document.getElementById('paymentTotal') as HTMLInputElement).value = String(displayedTotal);
  (document.getElementById('paymentAmountPaid') as HTMLInputElement).value = String(payment.amount_paid ?? 0);
  (document.getElementById('paymentStatus') as HTMLSelectElement).value = payment.payment_status ?? 'unpaid';
  (document.getElementById('paymentMethod') as HTMLInputElement).value = payment.payment_method ?? '';
  (document.getElementById('paymentNotes') as HTMLTextAreaElement).value = payment.payment_notes ?? '';
  (document.getElementById('paymentRecordedAt') as HTMLInputElement).value = payment.payment_recorded_at
    ? new Date(payment.payment_recorded_at).toISOString().slice(0, 16)
    : new Date().toISOString().slice(0, 16);
  updatePaymentCalculations();
  const saveButton = document.getElementById('savePaymentButton');
  if (saveButton) saveButton.textContent = customBooking && !quoteFinalized ? 'Finalize Quotation' : customBooking ? 'Save Quotation / Payment' : 'Save Payment';
  document.getElementById('paymentModal')?.classList.remove('hidden');
}

function closePaymentModal() {
  document.getElementById('paymentModal')?.classList.add('hidden');
}

async function submitPayment() {
  const button = document.getElementById('savePaymentButton') as HTMLButtonElement;
  const recordedValue = (document.getElementById('paymentRecordedAt') as HTMLInputElement).value;
  const payload = {
    bookingId: (document.getElementById('paymentBookingId') as HTMLInputElement).value,
    totalBookingAmount: Number((document.getElementById('paymentTotal') as HTMLInputElement).value),
    amountPaid: Number((document.getElementById('paymentAmountPaid') as HTMLInputElement).value),
    paymentStatus: (document.getElementById('paymentStatus') as HTMLSelectElement).value,
    paymentMethod: (document.getElementById('paymentMethod') as HTMLInputElement).value.trim() || null,
    paymentNotes: (document.getElementById('paymentNotes') as HTMLTextAreaElement).value.trim() || null,
    paymentRecordedAt: recordedValue ? new Date(recordedValue).toISOString() : null,
  };
  button.disabled = true;
  const response = await fetch('/api/admin/update-booking-payment', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const result = await response.json();
  button.disabled = false;
  if (!response.ok) { toast(result.error ?? 'Could not save payment', false); return; }
  toast(result.warning ? `Payment saved, but ${result.warning}` : result.message ?? 'Payment information saved');
  closePaymentModal();
  window.location.reload();
}

document.getElementById('paymentTotal')?.addEventListener('input', updatePaymentCalculations);
document.getElementById('paymentAmountPaid')?.addEventListener('input', updatePaymentCalculations);
document.getElementById('paymentModal')?.addEventListener('click', function(event) {
  if (event.target === document.getElementById('paymentModal')) closePaymentModal();
});

function openBookingDetail(jsonStr: string) {
  const b = JSON.parse(jsonStr);
  const customBooking = isCustomBooking(b);
  const customPricingFinalized = customQuotationFinalized(b);
  const nextAction = getBookingNextActionLabel(b);

  const badge = document.getElementById('bd-status-badge')!;
  badge.textContent = customBooking && b.status === 'pending' && !customPricingFinalized ? 'Waiting for Quotation' : statusLabel(b.status);
  badge.className = 'px-3 py-1 rounded-full text-sm font-bold ' + (BOOKING_STATUS_CLASSES[b.status] ?? 'bg-gray-100 text-gray-600');
  toggleEl('bd-next-action-panel', Boolean(nextAction));
  setText('bd-next-action', nextAction);

  const fmt = function(d: string | null) {
    return d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
  };
  const fmtTs = function(d: string | null) {
    return d ? new Date(d).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' } as any) : '—';
  };
  const fmtLocalDateTime = function(value: string | null) {
    if (!value) return '—';
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return value;
    const [, year, month, day, hour, minute] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
      .toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' } as any);
  };

  setText('bd-name', b.full_name ?? 'No customer name submitted');
  setText('bd-phone', b.customerPhone ?? b.phone ?? 'No phone number saved');
  setText('bd-email', b.customerEmail ?? b.customer?.email ?? b.userName?.email ?? 'No email address saved');
  setText('bd-pax', b.pax ? b.pax + ' pax' : 'No guest count submitted');
  setText('bd-address', b.address?.trim() || 'No address submitted');
  const emailReady = b.customerEmail || b.customer?.email
    ? (b.customer?.email_notifications_enabled === false ? 'Disabled' : 'Enabled')
    : 'No email saved';
  const smsReady = b.customerPhone || b.phone || b.customer?.phone
    ? (b.customer?.sms_notifications_enabled === false ? 'Disabled' : 'Enabled')
    : 'No phone saved';
  setText('bd-email-notification', emailReady);
  setText('bd-sms-notification', smsReady);
  setText('bd-reminder', b.one_week_notice_sent_at ? 'Sent on ' + fmtTs(b.one_week_notice_sent_at) : 'Not sent');
  setText('bd-booking-type', customBooking ? 'Custom booking' : 'Preset package');
  setText('bd-venue', formatAssignedVenueNames(b));
  setText('bd-package', customBooking ? 'Not applicable - custom booking' : b.packageName ?? 'Package not recorded');
  const hasCurrentDateTimes = b.start_datetime?.slice(0, 10) === b.start_date
    && (!b.end_datetime || b.end_datetime.slice(0, 10) === b.end_date);
  const eventSchedule = b.start_datetime && hasCurrentDateTimes
    ? (b.end_datetime
      ? fmtLocalDateTime(b.start_datetime) + ' → ' + fmtLocalDateTime(b.end_datetime)
      : fmtLocalDateTime(b.start_datetime))
    : fmt(b.event_date ?? b.start_date);
  setText(
    'bd-event-date',
    eventSchedule,
  );
  setText(
    'bd-hold',
    b.start_datetime && hasCurrentDateTimes
      ? (b.end_datetime
        ? fmtLocalDateTime(b.start_datetime) + ' → ' + fmtLocalDateTime(b.end_datetime)
        : fmtLocalDateTime(b.start_datetime))
      : b.start_date === b.end_date ? fmt(b.start_date) : fmt(b.start_date) + ' → ' + fmt(b.end_date),
  );
  setText('bd-event-type', b.eventTypeName ?? b.event_type ?? 'No event type submitted');

  const estimate = b.estimate_summary && typeof b.estimate_summary === 'object' ? b.estimate_summary : {};
  setText('bd-package-price', customBooking ? 'Not applicable' : formatEstimateAmount(b.package_price ?? estimate.packageBase));
  setText('bd-estimate-rooms', formatEstimateAmount(estimate.rooms));
  setText('bd-estimate-addons', formatEstimateAmount(estimate.addOns));
  setText('bd-estimate-extensions', formatEstimateAmount(estimate.extensions));
  setText('bd-estimate-corkage', formatEstimateAmount(estimate.corkage));
  setText('bd-price-label', customBooking ? 'Rough additions estimate' : 'Estimated total');
  setText(
    'bd-price',
    customBooking
      ? formatEstimateAmount(estimate.roughAdditionsTotal)
      : formatEstimateAmount(b.total_price ?? estimate.total),
  );
  setText('bd-minimum', customBooking && !customPricingFinalized ? 'After staff quotation' : formatEstimateAmount(b.minimum_payment_amount ?? estimate.minimumPayment));
  setText('bd-balance', customBooking && !customPricingFinalized ? 'After staff quotation' : formatEstimateAmount(b.remaining_balance_amount ?? estimate.remainingBalance));
  setText(
    'bd-estimate-note',
    customBooking
      ? 'Rough estimate for selected priced additions only. The final booking total is confirmed by staff.'
      : 'Submitted estimate based on the selected package and extras. Final charges remain subject to staff review.',
  );
  setText(
    'bd-final-payable',
    customBooking && !customPricingFinalized
      ? 'Not finalized - checkout locked'
      : formatEstimateAmount(customBooking ? b.total_price : b.payment?.total_booking_amount ?? b.total_price),
  );
  setText('bd-payment-status', formatAdminPaymentStatus(b.payment?.payment_status));
  setText('bd-amount-paid', formatMoney(b.payment?.amount_paid));
  setText('bd-payment-balance', formatMoney(b.payment?.remaining_balance ?? b.total_price));
  setText('bd-payment-method', b.payment?.payment_method ?? 'No payment method recorded');
  setText('bd-payment-date', fmtTs(b.payment?.payment_recorded_at ?? null));
  setText('bd-payment-notes', b.payment?.payment_notes ?? '—');
  setText('bd-refund-status', formatAdminPaymentStatus(b.payment?.refund_status ?? 'not_required'));
  setText('bd-refund-amount', formatMoney(b.payment?.refund_amount));
  setText('bd-refund-processed', fmtTs(b.payment?.refund_processed_at ?? null));
  setText('bd-refund-notes', b.payment?.refund_notes ?? 'No refund notes recorded.');
  const reservation = getReservationDeadlineState(b);
  const reservationBadge = document.getElementById('bd-reservation-badge')!;
  reservationBadge.textContent = reservation.label;
  reservationBadge.className = `reservation-badge ${reservation.className}`;
  document.getElementById('bd-reservation-panel')?.classList.toggle('reservation-warning-cell', reservation.warning);
  setText('bd-reservation-created', fmtTs(b.reservation_created_at ?? null));
  setText('bd-reservation-expires', fmtTs(b.reservation_expires_at ?? null));
  setText('bd-reservation-remaining', reservationRemainingText(b.reservation_expires_at ?? null, reservation.kind));
  const showCancellationReason = b.status === 'cancelled'
    && Boolean(b.cancellation_reason || reservation.kind === 'expired_cancelled');
  toggleEl('bd-cancellation-reason-wrap', showCancellationReason);
  if (showCancellationReason) {
    setText('bd-cancellation-reason', b.cancellation_reason ?? 'Reservation expired after 48 hours without payment');
  }
  toggleEl('bd-reschedule-request-wrap', Boolean(b.pendingRescheduleRequest));
  if (b.pendingRescheduleRequest) {
    setText('bd-reschedule-request-schedule', formatRescheduleRequestSchedule(b.pendingRescheduleRequest));
    setText('bd-reschedule-request-created', fmtTs(b.pendingRescheduleRequest.created_at ?? null));
    setText('bd-reschedule-request-note', b.pendingRescheduleRequest.customer_note?.trim() || 'No customer note submitted.');
  }
  renderBookingItems('bd-inclusions', customBooking ? null : b.package_inclusions, customBooking ? 'No preset package inclusions.' : 'No package inclusions recorded.');
  renderBookingItems('bd-rooms', b.selected_rooms ?? b.additionals?.rooms, 'No rooms selected.');
  renderBookingItems(
    'bd-addons',
    combinedBookingItems(b.add_ons ?? b.additionals?.addOns, b.additionals?.customItems),
    'No optionals or add-ons selected.',
  );
  renderBookingItems('bd-extensions', b.extension_selections ?? b.additionals?.extensions, 'No extensions selected.');
  renderBookingItems('bd-corkage', b.corkage_selections ?? b.additionals?.corkage, 'No corkage selected.');
  setText(
    'bd-caterer',
    b.use_woodberry_caterer
      ? "Woodberry's caterer"
      : b.caterer?.trim() ? `Outside caterer — ${b.caterer.trim()}` : 'No caterer selected.',
  );
  setText('bd-created', fmtTs(b.created_at));
  setText('bd-updated', fmtTs(b.updated_at ?? null));
  setText('bd-terms', b.terms_accepted_at ? 'Accepted on ' + fmtTs(b.terms_accepted_at) : 'No acceptance recorded');
  setText('bd-requests', b.special_requests?.trim() || 'No special requests submitted.');

  toggleEl('bd-booked-wrap', !!b.confirmed_at);
  if (b.confirmed_at) setText('bd-booked', fmtTs(b.confirmed_at));
  toggleEl('bd-cancelled-wrap', !!b.cancelled_at);
  if (b.cancelled_at) setText('bd-cancelled', fmtTs(b.cancelled_at));
  toggleEl('bd-rescheduled-wrap', !!b.rescheduled_at);
  if (b.rescheduled_at) setText('bd-rescheduled', fmtTs(b.rescheduled_at));

  const auditHistory = document.getElementById('bd-audit-history')!;
  auditHistory.replaceChildren();
  if (!Array.isArray(b.auditHistory) || b.auditHistory.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'rounded-lg bg-gray-50 px-3 py-2 text-gray-500';
    empty.textContent = 'No audit events recorded for this booking yet.';
    auditHistory.appendChild(empty);
  } else {
    b.auditHistory.forEach((entry: any) => {
      const item = document.createElement('div');
      item.className = 'rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5';

      const heading = document.createElement('div');
      heading.className = 'flex flex-wrap items-center justify-between gap-2';
      const action = document.createElement('p');
      action.className = 'font-bold text-gray-700';
      action.textContent = String(entry.action ?? 'booking_updated').replaceAll('_', ' ');
      const timestamp = document.createElement('time');
      timestamp.className = 'text-xs text-gray-400';
      timestamp.textContent = fmtTs(entry.created_at);
      heading.append(action, timestamp);
      item.appendChild(heading);

      const details = document.createElement('p');
      details.className = 'mt-1 text-xs text-gray-500';
      const actor = String(entry.actor_role ?? 'system');
      const transition = entry.old_status || entry.new_status
        ? ` · ${entry.old_status ?? '—'} → ${entry.new_status ?? '—'}`
        : '';
      details.textContent = `${actor}${transition}`;
      item.appendChild(details);

      if (entry.reason) {
        const reason = document.createElement('p');
        reason.className = 'mt-1 text-xs text-gray-600';
        reason.textContent = `Reason: ${entry.reason}`;
        item.appendChild(reason);
      }
      auditHistory.appendChild(item);
    });
  }

  const actions = document.getElementById('bd-actions')!;
  actions.innerHTML = '';
  addActionBtn(
    actions,
    customBooking && !customPricingFinalized ? 'Finalize Quotation' : customBooking ? 'Edit Quotation / Payment' : 'Record Payment',
    'var(--wb-action)',
    function() { closeBookingDetail(); openPaymentModal(JSON.stringify(b)); },
  );
  if (b.status !== 'pending' && canTransitionBookingStatus(b.status, 'booked')) {
    addActionBtn(actions, '✓ Book', 'var(--wb-action)', function() { closeBookingDetail(); confirmBooking(b.id); });
  }
  if (canTransitionBookingStatus(b.status, 'rescheduled')) {
    addActionBtn(actions, '↻ Reschedule', 'var(--wb-action-warm)', function() { closeBookingDetail(); openReschedule(b.id); });
  }
  if (b.pendingRescheduleRequest) {
    addActionBtn(actions, 'Approve Request', 'var(--wb-action)', function() { closeBookingDetail(); approveRescheduleRequest(b.id); });
    addActionBtn(actions, 'Reject Request', 'var(--wb-danger-action)', function() { closeBookingDetail(); rejectRescheduleRequest(b.id); });
  }
  if (canTransitionBookingStatus(b.status, 'cancelled')) {
    addActionBtn(actions, '✕ Cancel', 'var(--wb-danger-action)', function() { closeBookingDetail(); cancelBooking(b.id); });
  }
  if (canTransitionBookingStatus(b.status, 'completed') && bookingHasEndedForAction(b)) {
    addActionBtn(actions, 'Complete', 'var(--wb-action-neutral)', function() { closeBookingDetail(); setBookingCompleted(b.id); });
  }
  if (b.status === 'cancelled' && (window as any).__isAdmin) {
    const manualActions = document.createElement('div');
    manualActions.className = 'w-full mt-2 pt-3 border-t border-red-200';
    const manualLabel = document.createElement('div');
    manualLabel.className = 'mb-2 text-xs font-bold uppercase tracking-wider text-red-700';
    manualLabel.textContent = 'Manual override action';
    manualActions.appendChild(manualLabel);
    addActionBtn(manualActions, 'Reopen as booked', 'var(--wb-danger-action)', function() {
      closeBookingDetail();
      manuallyReopenCancelledBooking(b.id, reservation.kind === 'expired_cancelled');
    });
    actions.appendChild(manualActions);
  }
  addActionBtn(actions, 'Close', 'var(--wb-action-neutral)', closeBookingDetail, true);
  document.getElementById('bookingDetailModal')?.classList.remove('hidden');
}

function closeBookingDetail() {
  document.getElementById('bookingDetailModal')?.classList.add('hidden');
}

document.getElementById('bookingDetailModal')?.addEventListener('click', function(e) {
  if (e.target === document.getElementById('bookingDetailModal')) closeBookingDetail();
});

// ── REPORTS (Fig 21 Weekly · Fig 22 Monthly) ─────────────────────────────────
let _reportMode: string = 'weekly';

function switchReport(mode: string) {
  _reportMode = mode;
  const weekly  = document.getElementById('rpt-week-picker')!;
  const monthly = document.getElementById('rpt-month-picker')!;
  const btnW    = document.getElementById('rpt-btn-weekly')!;
  const btnM    = document.getElementById('rpt-btn-monthly')!;
  if (mode === 'weekly') {
    weekly.classList.remove('hidden');
    monthly.classList.add('hidden');
    btnW.style.cssText = 'background:var(--wb-action);color:var(--wb-on-action);';
    btnM.style.cssText = 'background:white;color:var(--wb-green-dark);';
  } else {
    monthly.classList.remove('hidden');
    weekly.classList.add('hidden');
    btnM.style.cssText = 'background:var(--wb-action);color:var(--wb-on-action);';
    btnW.style.cssText = 'background:white;color:var(--wb-green-dark);';
  }
}

function getWeekRange(dateStr: string): [Date, Date] {
  const d   = new Date(dateStr);
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((day + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return [mon, sun];
}

function getMonthRange(monthStr: string): [Date, Date] {
  const parts = monthStr.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const start = new Date(y, m - 1, 1);
  const end   = new Date(y, m, 0, 23, 59, 59, 999);
  return [start, end];
}

function generateLegacyReport() {
  const allBookings: any[] = (window as any).__allBookings ?? [];
  let rangeStart: Date;
  let rangeEnd: Date;
  let rptTitle: string;
  let periodLabel: string;

  if (_reportMode === 'weekly') {
    const val = (document.getElementById('rpt-week-input') as HTMLInputElement).value;
    if (!val) { toast('Pick a week date first', false); return; }
    const range = getWeekRange(val);
    rangeStart = range[0];
    rangeEnd   = range[1];
    const fmtShort = function(d: Date) { return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }); };
    rptTitle    = 'Weekly Booking Report';
    periodLabel = fmtShort(rangeStart) + ' – ' + fmtShort(rangeEnd);
  } else {
    const val = (document.getElementById('rpt-month-input') as HTMLInputElement).value;
    if (!val) { toast('Pick a month first', false); return; }
    const range = getMonthRange(val);
    rangeStart  = range[0];
    rangeEnd    = range[1];
    rptTitle    = 'Monthly Booking Report';
    periodLabel = rangeStart.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  }

  const inRange = allBookings.filter(function(b) {
    const d = new Date(b.event_date ?? b.created_at);
    return d >= rangeStart && d <= rangeEnd;
  });

  const total       = inRange.length;
  const booked   = inRange.filter(function(b) { return b.status === 'booked'; }).length;
  const cancelled   = inRange.filter(function(b) { return b.status === 'cancelled'; }).length;
  const rescheduled = inRange.filter(function(b) { return b.status === 'rescheduled'; }).length;
  const completed = inRange.filter(function(b) { return b.status === 'completed'; }).length;
  const revenue = inRange.reduce(function(sum, booking) {
    return sum + (booking.payment?.payment_status === 'refunded' ? 0 : Number(booking.payment?.amount_paid ?? 0));
  }, 0);

  setText('rpt-title',       rptTitle);
  setText('rpt-period',      periodLabel);
  setText('rpt-generated',   new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' } as any));
  setText('rpt-total',       String(total));
  setText('rpt-booked',      String(booked));
  setText('rpt-cancelled',   String(cancelled));
  setText('rpt-rescheduled', String(rescheduled));
  setText('rpt-completed', String(completed));
  setText('rpt-revenue',     '₱' + revenue.toLocaleString());

  // Distribution by date
  const byDate: Record<string, number> = {};
  inRange.forEach(function(b) {
    const d = (b.event_date ?? b.created_at)?.split('T')[0] ?? 'Unknown';
    byDate[d] = (byDate[d] ?? 0) + 1;
  });
  const maxCount = Math.max.apply(null, (Object.values(byDate) as number[]).concat([1]));
  const distEl = document.getElementById('rpt-distribution')!;
  const distEntries = Object.entries(byDate).sort(function(a, b) { return a[0].localeCompare(b[0]); });
  if (distEntries.length === 0) {
    distEl.innerHTML = '<p class="text-gray-400 text-sm">No data</p>';
  } else {
    distEl.innerHTML = distEntries.map(function(entry) {
      const date  = entry[0];
      const count = entry[1] as number;
      const pct   = Math.round((count / maxCount) * 100);
      const label = new Date(date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
      return '<div class="flex items-center gap-3">'
        + '<span class="text-gray-500 w-28 shrink-0">' + label + '</span>'
        + '<div class="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">'
        + '<div class="h-full rounded-full" style="width:' + pct + '%;background:var(--butterscotch-primary);"></div></div>'
        + '<span class="font-bold w-6 text-right">' + count + '</span></div>';
    }).join('');
  }

  // Breakdown by event type / package
  const byType: Record<string, { count: number; revenue: number }> = {};
  inRange.forEach(function(b) {
    const key = b.packageName ?? b.event_type ?? 'Unspecified';
    if (!byType[key]) byType[key] = { count: 0, revenue: 0 };
    byType[key].count++;
    if (b.payment?.payment_status !== 'refunded') byType[key].revenue += Number(b.payment?.amount_paid ?? 0);
  });
  const brkBody = document.getElementById('rpt-breakdown-body')!;
  const brkEntries = Object.entries(byType).sort(function(a, b) { return (b[1] as any).count - (a[1] as any).count; });
  brkBody.innerHTML = brkEntries.length
    ? brkEntries.map(function(entry) {
        const type = entry[0];
        const d    = entry[1] as { count: number; revenue: number };
        return '<tr class="border-t border-gray-50">'
          + '<td class="px-4 py-2 font-medium">' + type + '</td>'
          + '<td class="px-4 py-2 text-gray-600">' + d.count + '</td>'
          + '<td class="px-4 py-2 font-semibold" style="color:var(--butterscotch-primary);">₱' + d.revenue.toLocaleString() + '</td></tr>';
      }).join('')
    : '<tr><td colspan="3" class="px-4 py-4 text-center text-gray-400">No data</td></tr>';

  // All bookings table
  const bkBody = document.getElementById('rpt-bookings-body')!;
  const fmtDate = function(d: string | null) {
    return d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  };
  bkBody.innerHTML = inRange.length
    ? inRange.map(function(b) {
        const sc = BOOKING_STATUS_CLASSES[b.status] ?? 'bg-gray-100 text-gray-600';
        return '<tr class="border-t border-gray-50 hover:bg-gray-50">'
          + '<td class="px-3 py-2 font-medium">' + (b.full_name ?? '—') + '</td>'
          + '<td class="px-3 py-2 text-gray-600">' + (b.venueName ?? '—') + '</td>'
          + '<td class="px-3 py-2 text-gray-600">' + (b.packageName ?? b.event_type ?? '—') + '</td>'
          + '<td class="px-3 py-2 text-gray-600">' + fmtDate(b.event_date) + '</td>'
          + '<td class="px-3 py-2 text-gray-600">' + (b.pax ?? '—') + '</td>'
          + '<td class="px-3 py-2 font-semibold" style="color:var(--butterscotch-primary);">' + (b.total_price ? '₱' + Number(b.total_price).toLocaleString() : '—') + '</td>'
          + '<td class="px-3 py-2"><span class="px-2 py-0.5 rounded-full text-xs font-bold ' + sc + '">' + statusLabel(b.status) + '</span></td></tr>';
      }).join('')
    : '<tr><td colspan="7" class="px-3 py-8 text-center text-gray-400">No bookings in this period.</td></tr>';

  document.getElementById('report-output')!.classList.remove('hidden');
  document.getElementById('report-empty')!.classList.add('hidden');
}

async function generateReport() {
  const anchor = _reportMode === 'weekly'
    ? (document.getElementById('rpt-week-input') as HTMLInputElement).value
    : (document.getElementById('rpt-month-input') as HTMLInputElement).value;
  if (!anchor) { toast(`Pick a ${_reportMode === 'weekly' ? 'week' : 'month'} first`, false); return; }

  const button = document.getElementById('generate-report-button') as HTMLButtonElement | null;
  if (button) { button.disabled = true; button.textContent = 'Generating…'; }
  try {
    const response = await fetch(`/api/admin/sales-report?period=${encodeURIComponent(_reportMode)}&anchor=${encodeURIComponent(anchor)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? 'Could not generate the sales report');

    const report = payload.report;
    const forecast = payload.forecast;
    const reportBookings: any[] = payload.bookings ?? [];
    const money = (value: unknown) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value ?? 0));
    const safe = (value: unknown) => String(value ?? '—').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char] ?? char));
    const date = (value: string | null) => value ? new Date(value).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' }) : '—';
    const start = new Date(report.period.start);
    const end = new Date(report.period.endExclusive); end.setUTCDate(end.getUTCDate() - 1);
    const periodLabel = _reportMode === 'weekly'
      ? `${date(start.toISOString())} – ${date(end.toISOString())}`
      : start.toLocaleDateString('en-PH', { month:'long', year:'numeric', timeZone:'UTC' });

    setText('rpt-title', _reportMode === 'weekly' ? 'Weekly Sales Report' : 'Monthly Sales Report');
    setText('rpt-period', periodLabel);
    setText('rpt-generated', new Date().toLocaleString('en-PH', { dateStyle:'medium', timeStyle:'short' } as any));
    setText('rpt-total', String(report.totalBookings));
    setText('rpt-pending', String(report.pendingReservations));
    setText('rpt-cancelled', String(report.cancelledBookings));
    setText('rpt-gross', money(report.grossRevenue));
    setText('rpt-paid', money(report.paidRevenue));
    setText('rpt-unpaid', money(report.unpaidBalance));
    setText('rpt-top-package', report.mostSelectedPackages?.[0]?.packageName ?? '—');
    setText('rpt-cancel-count', String(report.cancellationCount));
    setText('rpt-cancel-rate', `${Number(report.cancellationRate).toLocaleString()}%`);
    setText('rpt-cancel-value', money(report.cancelledBookingValue));
    setText('rpt-cancel-retained', money(report.retainedCancellationRevenue));

    const forecastDate = new Date(`${forecast.targetMonth}-01T00:00:00Z`);
    setText('rpt-forecast-period', forecastDate.toLocaleDateString('en-PH', { month:'long', year:'numeric', timeZone:'UTC' }));
    const forecastUnavailable = document.getElementById('rpt-forecast-unavailable')!;
    const forecastResults = document.getElementById('rpt-forecast-results')!;
    const forecastMethod = document.getElementById('rpt-forecast-method')!;
    if (!forecast.available) {
      setText('rpt-forecast-unavailable', forecast.message);
      forecastUnavailable.classList.remove('hidden');
      forecastResults.classList.add('hidden');
      forecastMethod.classList.add('hidden');
    } else {
      setText('rpt-forecast-bookings', String(forecast.expectedBookings));
      setText('rpt-forecast-revenue', money(forecast.expectedRevenue));
      setText('rpt-forecast-package', forecast.likelyTopPackage);
      setText('rpt-forecast-method', `Based on ${forecast.monthsUsed.join(', ')} using a ${forecast.method}. This is a simple historical estimate, not a guarantee or reliable AI prediction.`);
      forecastUnavailable.classList.add('hidden');
      forecastResults.classList.remove('hidden');
      forecastMethod.classList.remove('hidden');
    }

    const breakdown = document.getElementById('rpt-breakdown-body')!;
    breakdown.innerHTML = report.revenueByPackage.length
      ? report.revenueByPackage.map((item: any) => `<tr class="border-t border-gray-50"><td class="px-4 py-2 font-medium">${safe(item.packageName)}</td><td class="px-4 py-2 text-gray-600">${item.bookingCount}</td><td class="px-4 py-2 font-semibold">${money(item.revenue)}</td></tr>`).join('')
      : '<tr><td colspan="3" class="px-4 py-6 text-center text-gray-400">No package revenue in this period.</td></tr>';

    const body = document.getElementById('rpt-bookings-body')!;
    body.innerHTML = reportBookings.length
      ? reportBookings.map((booking: any) => {
          const payment = booking.payment;
          const total = payment?.total_booking_amount ?? booking.total_price ?? 0;
          const paid = payment?.payment_status === 'refunded' ? 0 : payment?.amount_paid ?? 0;
          const statusClass = BOOKING_STATUS_CLASSES[booking.status] ?? 'bg-gray-100 text-gray-600';
          return `<tr class="border-t border-gray-50"><td class="px-3 py-2 font-medium">${safe(booking.full_name)}</td><td class="px-3 py-2 text-gray-600">${safe(booking.venueName)}</td><td class="px-3 py-2 text-gray-600">${safe(booking.packageName)}</td><td class="px-3 py-2 text-gray-600">${date(booking.event_date)}</td><td class="px-3 py-2 text-gray-600">${safe(booking.pax)}</td><td class="px-3 py-2 font-semibold">${money(total)}<small class="report-paid-line">Paid ${money(paid)}</small></td><td class="px-3 py-2"><span class="px-2 py-0.5 rounded-full text-xs font-bold ${statusClass}">${safe(statusLabel(booking.status))}</span></td></tr>`;
        }).join('')
      : '<tr><td colspan="7" class="px-3 py-8 text-center text-gray-400">No bookings were created in this period.</td></tr>';

    const distribution = document.getElementById('rpt-distribution')!;
    distribution.innerHTML = '<p class="report-period-note">Figures include bookings created during the selected period. Gross revenue recognizes booked and completed reservations plus retained cancellation payments.</p>';
    document.getElementById('report-output')!.classList.remove('hidden');
    document.getElementById('report-empty')!.classList.add('hidden');
  } catch (reportError) {
    toast(reportError instanceof Error ? reportError.message : 'Could not generate the report', false);
  } finally {
    if (button) { button.disabled = false; button.textContent = 'Generate Report'; }
  }
}

function printReport() {
  const output = document.getElementById('report-output');
  if (!output || output.classList.contains('hidden')) { toast('Generate a report first', false); return; }
  window.print();
}

// Seed date pickers on load
const _today    = new Date();
const _todayStr = _today.toISOString().split('T')[0];
const _wkInput  = document.getElementById('rpt-week-input') as HTMLInputElement;
const _moInput  = document.getElementById('rpt-month-input') as HTMLInputElement;
if (_wkInput) _wkInput.value = _todayStr;
if (_moInput) _moInput.value = _today.getFullYear() + '-' + String(_today.getMonth() + 1).padStart(2, '0');
switchReport('weekly');

// ── EXPOSE TO HTML onclick ATTRIBUTES ────────────────────────────────────────
(window as any).confirmBooking    = confirmBooking;
(window as any).cancelBooking     = cancelBooking;
(window as any).updateBookingStatus = updateBookingStatus;
(window as any).manuallyReopenCancelledBooking = manuallyReopenCancelledBooking;
(window as any).setBookingCompleted = setBookingCompleted;
(window as any).openReschedule    = openReschedule;
(window as any).closeReschedule   = closeReschedule;
(window as any).submitReschedule  = submitReschedule;
(window as any).approveRescheduleRequest = approveRescheduleRequest;
(window as any).rejectRescheduleRequest = rejectRescheduleRequest;
(window as any).openPackageModal  = openPackageModal;
(window as any).closePackageModal = closePackageModal;
(window as any).openVenueModal = openVenueModal;
(window as any).closeVenueModal = closeVenueModal;
(window as any).submitVenue = submitVenue;
(window as any).deleteVenue = deleteVenue;
(window as any).toggleVenue = toggleVenue;
(window as any).openPackageVenueModal = openPackageVenueModal;
(window as any).closePackageVenueModal = closePackageVenueModal;
(window as any).deactivatePackageVenue = deactivatePackageVenue;
(window as any).submitPackage     = submitPackage;
(window as any).togglePackage     = togglePackage;
(window as any).deletePackage     = deletePackage;
(window as any).promoteUser       = promoteUser;
(window as any).demoteUser        = demoteUser;
(window as any).promoteStaff      = promoteStaff;
(window as any).demoteStaff       = demoteStaff;
(window as any).openStaffModal    = openStaffModal;
(window as any).closeStaffModal   = closeStaffModal;
(window as any).setStaffStatus    = setStaffStatus;
(window as any).openBookingDetail = openBookingDetail;
(window as any).closeBookingDetail = closeBookingDetail;
(window as any).openPaymentModal = openPaymentModal;
(window as any).closePaymentModal = closePaymentModal;
(window as any).submitPayment = submitPayment;
(window as any).switchReport      = switchReport;
(window as any).generateReport    = generateReport;
(window as any).printReport       = printReport;
(window as any).deactivateBlockedDate = deactivateBlockedDate;
(window as any).activateBlockedDate = activateBlockedDate;
(window as any).editBlockedDate = editBlockedDate;
(window as any).resetBlockedDateForm = resetBlockedDateForm;

// ── ADMIN AVAILABILITY CALENDAR ───────────────────────────────────────────────
const admMonths = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];
let admYear  = new Date().getFullYear();
let admMonth = new Date().getMonth(); // 0-indexed
type AdminAvailability = { bookings: any[]; blockedDates: any[] };
const admCache: Record<string, AdminAvailability> = {};
let activeBlockedDates: any[] = [];
const adminVenues: any[] = (window as any).__venues ?? [];
const BLOCKING_BOOKING_STATUSES = new Set(['pending', 'booked', 'rescheduled']);
const ACTIVE_BOOKING_STATUSES = new Set(['booked', 'rescheduled']);

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function venueNameById(id: string): string {
  return adminVenues.find((venue: any) => venue.id === id)?.name ?? 'Venue';
}

function formatAdminDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatAdminDateRange(start: string, end: string): string {
  return start === end ? formatAdminDate(start) : `${formatAdminDate(start)} to ${formatAdminDate(end)}`;
}

function clearAvailabilityCache() {
  Object.keys(admCache).forEach((key) => delete admCache[key]);
}

function setAvailabilityMessage(message = '') {
  const element = document.getElementById('availabilityMessage');
  if (!element) return;
  if (!message) {
    element.textContent = '';
    element.classList.add('hidden');
    return;
  }
  element.textContent = message;
  element.classList.remove('hidden');
}

function getCalendarVenueId(): string {
  return (document.getElementById('calendarVenueFilter') as HTMLSelectElement | null)?.value ?? '';
}

function getCalendarRange() {
  const startDate = (document.getElementById('calendarRangeStart') as HTMLInputElement | null)?.value ?? '';
  const endDate = (document.getElementById('calendarRangeEnd') as HTMLInputElement | null)?.value ?? '';
  return { startDate, endDate };
}

function normalizeBlockedDate(block: any) {
  return {
    id: block.id,
    venueId: block.venueId ?? block.venue_id,
    startDate: block.startDate ?? block.start_date,
    endDate: block.endDate ?? block.end_date,
    reason: block.reason ?? '',
    isActive: block.isActive ?? block.is_active ?? true,
  };
}

function datesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  if (!startB && !endB) return true;
  const filterStart = startB || endB;
  const filterEnd = endB || startB;
  return startA <= filterEnd && endA >= filterStart;
}

function dateIsInsideFilter(iso: string): boolean {
  const { startDate, endDate } = getCalendarRange();
  if (startDate && iso < startDate) return false;
  if (endDate && iso > endDate) return false;
  return true;
}

function isBlockingBookingStatus(status: string): boolean {
  return BLOCKING_BOOKING_STATUSES.has(status);
}

function isActiveBookingStatus(status: string): boolean {
  return ACTIVE_BOOKING_STATUSES.has(status);
}

async function admFetchAvailability(year: number, month: number): Promise<AdminAvailability> {
  const venueId = getCalendarVenueId();
  const key = `${year}-${month}-${venueId || 'all'}`;
  if (admCache[key]) return admCache[key];
  const loading = document.getElementById('adm-cal-loading')!;
  loading.style.display = 'block';
  try {
    const params = new URLSearchParams({ year: String(year), month: String(month + 1) });
    if (venueId) params.set('venueId', venueId);
    const res  = await fetch(`/api/bookings/availability?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? json.message ?? 'Could not load availability');
    admCache[key] = {
      bookings: json.bookings ?? [],
      blockedDates: json.blockedDates ?? [],
    };
    setAvailabilityMessage();
    return admCache[key];
  } catch (availabilityError) {
    const message = availabilityError instanceof Error ? availabilityError.message : 'Could not load availability';
    setAvailabilityMessage(message);
    return { bookings: [], blockedDates: [] };
  }
  finally { loading.style.display = 'none'; }
}

// Build a map of dateISO -> bookings[]
function admBuildDateMap(bookings: any[]): Record<string, any[]> {
  const map: Record<string, any[]> = {};
  const { startDate: filterStart, endDate: filterEnd } = getCalendarRange();
  for (const b of bookings) {
    const bookingStart = b.start_date ?? b.event_date;
    const bookingEnd = b.end_date ?? b.event_date;
    if (!bookingStart || !bookingEnd || !datesOverlap(bookingStart, bookingEnd, filterStart, filterEnd)) continue;
    const start = new Date(bookingStart + 'T00:00:00');
    const end   = new Date(bookingEnd + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().split('T')[0];
      if (!dateIsInsideFilter(iso)) continue;
      if (!map[iso]) map[iso] = [];
      map[iso].push(b);
    }
  }
  return map;
}

function admBuildBlockedDateMap(blockedDates: any[]): Record<string, any[]> {
  const map: Record<string, any[]> = {};
  const { startDate: filterStart, endDate: filterEnd } = getCalendarRange();
  for (const rawBlock of blockedDates) {
    const block = normalizeBlockedDate(rawBlock);
    if (!block.isActive || !datesOverlap(block.startDate, block.endDate, filterStart, filterEnd)) continue;
    const start = new Date(block.startDate + 'T00:00:00');
    const end = new Date(block.endDate + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().split('T')[0];
      if (!dateIsInsideFilter(iso)) continue;
      if (!map[iso]) map[iso] = [];
      map[iso].push(rawBlock);
    }
  }
  return map;
}

const STATUS_CELL: Record<string, { bg: string; ring: string; text: string }> = {
  pending: { bg: '#fff4cf', ring: '#b48422', text: '#6f4d00' },
  booked:   { bg: 'var(--wb-success-bg)', ring: 'var(--wb-success-border)', text: 'var(--wb-success-text)' },
  rescheduled: { bg: 'var(--wb-green-soft)', ring: 'var(--wb-green-pale)', text: 'var(--wb-link)' },
  cancelled: { bg: 'var(--wb-danger-bg)', ring: 'var(--wb-danger-border)', text: 'var(--wb-danger-text)' },
  completed: { bg: 'var(--wb-surface-soft)', ring: 'var(--wb-border)', text: 'var(--wb-muted)' },
};
const BLOCKED_CELL = { bg: 'var(--wb-warning-bg)', ring: 'var(--wb-warning-border)', text: 'var(--wb-warning-text)' };

async function loadBlockedDates() {
  const list = document.getElementById('blockedDateList');
  if (list) list.innerHTML = '<p class="blocked-date-empty">Loading blocked dates...</p>';
  try {
    const res = await fetch('/api/admin/blocked-dates?includeInactive=true');
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error ?? payload.message ?? 'Could not load blocked dates');
    activeBlockedDates = payload.blockedDates ?? [];
    renderBlockedDateList();
    setAvailabilityMessage();
  } catch (loadError) {
    const message = loadError instanceof Error ? loadError.message : 'Could not load blocked dates';
    if (list) list.innerHTML = `<p class="blocked-date-empty">${escapeHtml(message)}</p>`;
    setAvailabilityMessage(message);
  }
}

function renderBlockedDateList() {
  const list = document.getElementById('blockedDateList');
  if (!list) return;
  const statusFilter = (document.getElementById('blockedStatusFilter') as HTMLSelectElement | null)?.value ?? 'active';
  const venueId = getCalendarVenueId();
  const { startDate, endDate } = getCalendarRange();
  const blockedDates = activeBlockedDates
    .map(normalizeBlockedDate)
    .filter((block) => statusFilter === 'all' || (statusFilter === 'active' ? block.isActive : !block.isActive))
    .filter((block) => !venueId || block.venueId === venueId)
    .filter((block) => datesOverlap(block.startDate, block.endDate, startDate, endDate));

  if (blockedDates.length === 0) {
    list.innerHTML = '<p class="blocked-date-empty">No blocked dates match the current filters.</p>';
    return;
  }

  list.innerHTML = blockedDates
    .map((block) => `
      <div class="blocked-date-card ${block.isActive ? '' : 'is-inactive'}">
        <strong>${escapeHtml(venueNameById(block.venueId))}</strong>
        <p>${escapeHtml(formatAdminDateRange(block.startDate, block.endDate))}</p>
        <p>${escapeHtml(block.reason)}</p>
        <div class="blocked-date-card__meta">
          <span class="blocked-date-badge ${block.isActive ? '' : 'is-inactive'}">${block.isActive ? 'Active' : 'Inactive'}</span>
        </div>
        <div class="blocked-date-card__actions">
          <button class="secondary" type="button" onclick="editBlockedDate('${escapeHtml(block.id)}')">Edit</button>
          ${block.isActive
            ? `<button type="button" onclick="deactivateBlockedDate('${escapeHtml(block.id)}')">Deactivate</button>`
            : `<button class="activate" type="button" onclick="activateBlockedDate('${escapeHtml(block.id)}')">Activate</button>`
          }
        </div>
      </div>
    `)
    .join('');
}

function resetBlockedDateForm() {
  const form = document.getElementById('blockedDateForm') as HTMLFormElement | null;
  form?.reset();
  const idInput = document.getElementById('blockedDateId') as HTMLInputElement | null;
  const title = document.getElementById('blockedDateFormTitle');
  const submit = document.getElementById('blockedDateSubmit') as HTMLButtonElement | null;
  const cancel = document.getElementById('cancelBlockedDateEdit');
  if (idInput) idInput.value = '';
  if (title) title.textContent = 'Block venue dates';
  if (submit) submit.textContent = 'Block Dates';
  cancel?.classList.add('hidden');
}

function editBlockedDate(id: string) {
  const block = activeBlockedDates.map(normalizeBlockedDate).find((item) => item.id === id);
  if (!block) {
    toast('Blocked date not found. Refresh and try again.', false);
    return;
  }
  (document.getElementById('blockedDateId') as HTMLInputElement | null)?.setAttribute('value', block.id);
  const idInput = document.getElementById('blockedDateId') as HTMLInputElement | null;
  const venueInput = document.getElementById('blockedVenue') as HTMLSelectElement | null;
  const startInput = document.getElementById('blockedStartDate') as HTMLInputElement | null;
  const endInput = document.getElementById('blockedEndDate') as HTMLInputElement | null;
  const reasonInput = document.getElementById('blockedReason') as HTMLTextAreaElement | null;
  const title = document.getElementById('blockedDateFormTitle');
  const submit = document.getElementById('blockedDateSubmit') as HTMLButtonElement | null;
  const cancel = document.getElementById('cancelBlockedDateEdit');
  if (idInput) idInput.value = block.id;
  if (venueInput) venueInput.value = block.venueId;
  if (startInput) startInput.value = block.startDate;
  if (endInput) endInput.value = block.endDate;
  if (reasonInput) reasonInput.value = block.reason;
  if (title) title.textContent = block.isActive ? 'Edit blocked dates' : 'Edit inactive blocked dates';
  if (submit) submit.textContent = 'Save Changes';
  cancel?.classList.remove('hidden');
  document.getElementById('blockedDateForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function createBlockedDate(event: Event) {
  event.preventDefault();
  const idInput = document.getElementById('blockedDateId') as HTMLInputElement | null;
  const venueInput = document.getElementById('blockedVenue') as HTMLSelectElement;
  const startInput = document.getElementById('blockedStartDate') as HTMLInputElement;
  const endInput = document.getElementById('blockedEndDate') as HTMLInputElement;
  const reasonInput = document.getElementById('blockedReason') as HTMLTextAreaElement;
  const reason = reasonInput.value.trim();
  const blockedDateId = idInput?.value ?? '';

  if (!venueInput.value || !startInput.value || !endInput.value || !reason) {
    toast('Please choose a venue, date range, and blocked-date reason.', false);
    setAvailabilityMessage('Please choose a venue, date range, and blocked-date reason.');
    return;
  }
  if (endInput.value < startInput.value) {
    toast('Blocked end date must be on or after start date.', false);
    setAvailabilityMessage('Blocked end date must be on or after start date.');
    return;
  }

  const confirmed = await showConfirm({
    title: blockedDateId ? 'Update Blocked Dates' : 'Block Dates',
    message: `${blockedDateId ? 'Update' : 'Block'} ${venueNameById(venueInput.value)} for ${formatAdminDateRange(startInput.value, endInput.value)}? Reason: ${reason}`,
    okLabel: blockedDateId ? 'Save Changes' : 'Block Dates',
    okColor: 'var(--wb-action-warm)',
    icon: '!',
  });
  if (!confirmed) return;

  const submitButton = (event.currentTarget as HTMLFormElement).querySelector('button[type="submit"]') as HTMLButtonElement | null;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Blocking...';
  }

  try {
    const res = await fetch('/api/admin/blocked-dates', {
      method: blockedDateId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(blockedDateId ? { id: blockedDateId } : {}),
        venueId: venueInput.value,
        startDate: startInput.value,
        endDate: endInput.value,
        reason,
        confirmedSensitiveAction: true,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error ?? payload.message ?? (blockedDateId ? 'Could not update blocked dates' : 'Could not block dates'));

    toast(blockedDateId ? 'Blocked date updated' : 'Dates blocked');
    resetBlockedDateForm();
    clearAvailabilityCache();
    await loadBlockedDates();
    await admRenderCalendar();
  } catch (blockError) {
    const message = blockError instanceof Error ? blockError.message : (blockedDateId ? 'Could not update blocked dates' : 'Could not block dates');
    toast(message, false);
    setAvailabilityMessage(message);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = blockedDateId ? 'Save Changes' : 'Block Dates';
    }
  }
}

async function setBlockedDateActive(id: string, isActive: boolean) {
  const block = activeBlockedDates.map(normalizeBlockedDate).find((item) => item.id === id);
  const actionLabel = isActive ? 'Activate' : 'Deactivate';
  const confirmed = await showConfirm({
    title: `${actionLabel} Blocked Date`,
    message: block
      ? `${actionLabel} the blocked date for ${venueNameById(block.venueId)} on ${formatAdminDateRange(block.startDate, block.endDate)}?`
      : `${actionLabel} this blocked date?`,
    okLabel: actionLabel,
    okColor: isActive ? 'var(--wb-action)' : 'var(--wb-danger-action)',
    icon: '!',
  });
  if (!confirmed) return;

  try {
    const res = await fetch('/api/admin/blocked-dates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive, confirmedSensitiveAction: true }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error ?? payload.message ?? `Could not ${isActive ? 'activate' : 'deactivate'} blocked date`);

    toast(isActive ? 'Blocked date activated' : 'Blocked date deactivated');
    resetBlockedDateForm();
    clearAvailabilityCache();
    await loadBlockedDates();
    await admRenderCalendar();
  } catch (changeError) {
    const message = changeError instanceof Error ? changeError.message : `Could not ${isActive ? 'activate' : 'deactivate'} blocked date`;
    toast(message, false);
    setAvailabilityMessage(message);
  }
}

function deactivateBlockedDate(id: string) {
  return setBlockedDateActive(id, false);
}

function activateBlockedDate(id: string) {
  return setBlockedDateActive(id, true);
}

async function admRenderCalendar() {
  const label = document.getElementById('adm-month-label')!;
  label.textContent = `${admMonths[admMonth]} ${admYear}`;
  const grid  = document.getElementById('adm-cal-grid')!;
  grid.innerHTML = '';

  const availability = await admFetchAvailability(admYear, admMonth);
  const dateMap  = admBuildDateMap(availability.bookings);
  const blockedDateMap = admBuildBlockedDateMap(availability.blockedDates);

  const firstDow  = new Date(admYear, admMonth, 1).getDay();
  const offset    = (firstDow + 6) % 7;
  const daysInMo  = new Date(admYear, admMonth + 1, 0).getDate();
  const total     = Math.ceil((offset + daysInMo) / 7) * 7;
  const todayISO  = new Date().toISOString().split('T')[0];

  for (let i = 0; i < total; i++) {
    const dayNum = i - offset + 1;
    const cell   = document.createElement('div');
    cell.style.cssText = 'min-height:90px;padding:6px;border:1px solid var(--wb-border);position:relative;cursor:pointer;transition:background 0.15s;';

    if (dayNum < 1 || dayNum > daysInMo) {
      cell.style.background = 'var(--wb-disabled-bg)';
      cell.style.cursor = 'default';
    } else {
      const iso = `${admYear}-${String(admMonth+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
      const dayBookings = dateMap[iso] ?? [];
      const dayBlocks = blockedDateMap[iso] ?? [];
      const isPast  = iso < todayISO;
      const isToday = iso === todayISO;
      const pendingBookings = dayBookings.filter((booking) => booking.status === 'pending');
      const activeBookings = dayBookings.filter((booking) => isActiveBookingStatus(booking.status));
      const historyBookings = dayBookings.filter((booking) => !isBlockingBookingStatus(booking.status));
      const hasBlockingBookings = pendingBookings.length > 0 || activeBookings.length > 0;
      const hasBlocks = dayBlocks.length > 0;
      const hasHistory = historyBookings.length > 0;
      const isFilteredOut = !dateIsInsideFilter(iso);
      const isUnavailable = hasBlockingBookings || hasBlocks;

      cell.style.background = isFilteredOut || (isPast && !isUnavailable)
        ? 'var(--wb-disabled-bg)'
        : activeBookings.length > 0
        ? 'var(--wb-danger-bg)'
        : pendingBookings.length > 0
        ? STATUS_CELL.pending.bg
        : hasBlocks
        ? BLOCKED_CELL.bg
        : hasHistory
        ? 'var(--wb-surface-soft)'
        : 'var(--wb-surface-raised)';
      if (isToday && !isUnavailable) cell.style.background = 'var(--wb-success-bg)';
      if (isFilteredOut) cell.style.opacity = '0.45';

      // Day number
      const num = document.createElement('div');
      num.textContent = String(dayNum);
      num.style.cssText = `font-size:0.8rem;font-weight:${isToday?'800':'600'};color:${isToday?'var(--wb-success-text)':'var(--wb-text)'};margin-bottom:3px;`;
      cell.appendChild(num);

      // Booking chips (max 3)
      const chips: Array<{ type: 'booking'; booking: any } | { type: 'blocked'; block: any }> = [
        ...activeBookings.map((booking) => ({ type: 'booking', booking })),
        ...pendingBookings.map((booking) => ({ type: 'booking', booking })),
        ...dayBlocks.map((block) => ({ type: 'blocked', block })),
        ...historyBookings.map((booking) => ({ type: 'booking', booking })),
      ];
      const shown = chips.slice(0, 3);
      for (const item of shown) {
        if (item.type === 'blocked') {
          const block = normalizeBlockedDate(item.block);
          const chip = document.createElement('div');
          chip.textContent = 'Blocked';
          chip.title = block.reason || 'Admin blocked';
          chip.style.cssText = `font-size:0.65rem;font-weight:700;padding:1px 5px;border-radius:4px;background:${BLOCKED_CELL.bg};color:${BLOCKED_CELL.text};outline:1px solid ${BLOCKED_CELL.ring};margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
          cell.appendChild(chip);
          continue;
        }
        const b = item.booking;
        const s = STATUS_CELL[b.status] ?? STATUS_CELL.booked;
        const chip = document.createElement('div');
        chip.textContent = b.status === 'pending' ? 'Pending' : statusLabel(b.status);
        chip.style.cssText = `font-size:0.65rem;font-weight:700;padding:1px 5px;border-radius:4px;background:${s.bg};color:${s.text};outline:1px solid ${s.ring};margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
        cell.appendChild(chip);
      }
      if (chips.length > 3) {
        const more = document.createElement('div');
        more.textContent = `+${chips.length - 3} more`;
        more.style.cssText = 'font-size:0.6rem;color:var(--wb-muted);font-weight:600;';
        cell.appendChild(more);
      }

      cell.addEventListener('mouseenter', () => {
        if (!isPast && !isFilteredOut) cell.style.background = activeBookings.length > 0 ? 'var(--wb-danger-bg)' : pendingBookings.length > 0 ? STATUS_CELL.pending.bg : hasBlocks ? 'var(--wb-warning-bg)' : 'var(--wb-green-soft)';
      });
      cell.addEventListener('mouseleave', () => {
        cell.style.background = isFilteredOut || (isPast && !isUnavailable)
          ? 'var(--wb-disabled-bg)'
          : activeBookings.length > 0
          ? 'var(--wb-danger-bg)'
          : pendingBookings.length > 0
          ? STATUS_CELL.pending.bg
          : hasBlocks
          ? BLOCKED_CELL.bg
          : isToday
          ? 'var(--wb-success-bg)'
          : hasHistory
          ? 'var(--wb-surface-soft)'
          : 'var(--wb-surface-raised)';
      });
      cell.addEventListener('click', () => admShowDayDetailV2(iso, dayBookings, dayBlocks));
    }

    grid.appendChild(cell);
  }
}

function admShowDayDetail(iso: string, bookings: any[], blockedDates: any[]) {
  const panel   = document.getElementById('adm-day-detail')!;
  const dateEl  = document.getElementById('adm-detail-date')!;
  const content = document.getElementById('adm-detail-content')!;

  const formatted = new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
  dateEl.textContent = formatted;
  panel.classList.remove('hidden');

  if (bookings.length === 0 && blockedDates.length === 0) {
    content.innerHTML = '<p class="text-gray-400 py-4 text-center">No bookings or blocked dates on this date. It is available.</p>';
    return;
  }

  // Fetch full booking data from window.__allBookings for names
  const allB: any[] = (window as any).__allBookings ?? [];
  const byId: Record<string, any> = {};
  allB.forEach((b: any) => { byId[b.id] = b; });

  const blockedHtml = blockedDates.map((block: any) => `
    <div style="padding:12px 16px;border-radius:12px;background:${BLOCKED_CELL.bg};outline:1.5px solid ${BLOCKED_CELL.ring};display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
      <div>
        <div style="font-weight:700;color:${BLOCKED_CELL.text};font-size:0.85rem;">Admin blocked</div>
        <div style="color:var(--wb-warning-text);font-size:0.75rem;margin-top:2px;">${escapeHtml(venueNameById(block.venue_id))}</div>
        <div style="color:var(--wb-warning-text);font-size:0.72rem;margin-top:2px;">${escapeHtml(formatAdminDateRange(block.start_date, block.end_date))}</div>
        <div style="color:var(--wb-warning-text);font-size:0.72rem;margin-top:4px;">${escapeHtml(block.reason)}</div>
      </div>
      <button onclick="deactivateBlockedDate('${escapeHtml(block.id)}')" style="padding:4px 10px;border-radius:6px;background:var(--wb-danger-action);color:var(--wb-on-danger);font-size:0.72rem;font-weight:700;border:none;cursor:pointer;">Unblock</button>
    </div>
  `).join('');

  const bookingsHtml = bookings.map(b => {
    const full = byId[b.id] ?? b;
    const s = STATUS_CELL[b.status] ?? STATUS_CELL.booked;
    const completeButton = bookingHasEndedForAction(full)
      ? `<button onclick="setBookingCompleted('${b.id}')" style="padding:4px 10px;border-radius:6px;background:var(--wb-action-neutral);color:var(--wb-on-action-neutral);font-size:0.72rem;font-weight:700;border:none;cursor:pointer;">Complete</button>`
      : '';
    const actionBtns = canTransitionBookingStatus(b.status, 'rescheduled')
      ? `<button onclick="openReschedule('${b.id}')" style="padding:4px 10px;border-radius:6px;background:var(--wb-action-warm);color:var(--wb-on-action-warm);font-size:0.72rem;font-weight:700;border:none;cursor:pointer;">↻ Reschedule</button>
         <button onclick="cancelBooking('${b.id}')" style="padding:4px 10px;border-radius:6px;background:var(--wb-danger-action);color:var(--wb-on-danger);font-size:0.72rem;font-weight:700;border:none;cursor:pointer;">✕ Cancel</button>
         ${completeButton}`
      : canTransitionBookingStatus(b.status, 'booked') && b.status === 'rescheduled'
      ? `<button onclick="confirmBooking('${b.id}')" style="padding:4px 10px;border-radius:6px;background:var(--wb-action);color:var(--wb-on-action);font-size:0.72rem;font-weight:700;border:none;cursor:pointer;">✓ Book</button>
         <button onclick="cancelBooking('${b.id}')" style="padding:4px 10px;border-radius:6px;background:var(--wb-danger-action);color:var(--wb-on-danger);font-size:0.72rem;font-weight:700;border:none;cursor:pointer;">✕ Cancel</button>`
      : '';
    return `<div style="padding:12px 16px;border-radius:12px;background:${s.bg};outline:1.5px solid ${s.ring};display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
      <div>
        <div style="font-weight:700;color:${s.text};font-size:0.85rem;">${full.full_name ?? full.venueName ?? 'Guest'}</div>
        <div style="color:var(--wb-muted);font-size:0.75rem;margin-top:2px;">${full.venueName ?? ''} ${full.event_type ? '· ' + full.event_type : ''}</div>
        <div style="color:var(--wb-muted);font-size:0.72rem;margin-top:2px;">${new Date(b.start_date+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'})} → ${new Date(b.end_date+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'})}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
        <span style="font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:9999px;background:${s.bg};color:${s.text};outline:1px solid ${s.ring};">${statusLabel(b.status)}</span>
        <div style="display:flex;gap:4px;flex-wrap:wrap;">${actionBtns}</div>
      </div>
    </div>`;
  }).join('');

  content.innerHTML = blockedHtml + bookingsHtml;
}

document.getElementById('adm-detail-close')?.addEventListener('click', () => {
  document.getElementById('adm-day-detail')?.classList.add('hidden');
});
document.getElementById('adm-prev-month')?.addEventListener('click', () => {
  if (admMonth === 0) { admMonth = 11; admYear--; } else { admMonth--; }
  admRenderCalendar();
  document.getElementById('adm-day-detail')?.classList.add('hidden');
});
document.getElementById('adm-next-month')?.addEventListener('click', () => {
  if (admMonth === 11) { admMonth = 0; admYear++; } else { admMonth++; }
  admRenderCalendar();
  document.getElementById('adm-day-detail')?.classList.add('hidden');
});
document.getElementById('blockedDateForm')?.addEventListener('submit', createBlockedDate);
document.getElementById('refreshBlockedDates')?.addEventListener('click', () => loadBlockedDates());
loadBlockedDates();

// Render calendar when the tab becomes active
const _origSwitchTab = (window as any).switchTab;
document.querySelectorAll<HTMLElement>('.nav-btn[data-tab="calendar"]').forEach(btn => {
  btn.addEventListener('click', () => {
    loadBlockedDates();
    admRenderCalendar();
  });
});
