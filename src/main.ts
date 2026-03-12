import './styles/main.scss';
import {
  listTrips,
  getTrip,
  createTrip,
  deleteTrip,
  importTrip,
  setActiveTrip,
  getState,
  addParticipant,
  removeParticipant,
  addExpense,
  removeExpense,
  setCurrency,
  renameTrip,
} from './store';
import { calculateSettlements, calculateBalances, totalExpenses } from './calculator';
import { parseRoute, navigate } from './router';
import { encodeTripToShareUrl, decodeTripFromPayload } from './share';
// ---------------------------------------------------------------------------
// Currency config
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  const { currency } = getState();
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function el<T extends HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Element not found: ${selector}`);
  return found;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

let tripViewBooted = false;

function handleRoute(): void {
  const route = parseRoute(window.location.hash);

  if (route.view === 'share') {
    handleShareImport(route.payload);
    return;
  }

  if (route.view === 'trip') {
    const trip = getTrip(route.tripId);
    if (!trip) {
      navigate('');
      return;
    }
    showTripView(trip.id);
    return;
  }

  showHomeView();
}

// ---------------------------------------------------------------------------
// Screen switching
// ---------------------------------------------------------------------------

function showHomeView(): void {
  el('#view-home').hidden = false;
  el('#view-trip').hidden = true;
  el('.header').classList.remove('header--trip');
  el('.header').classList.add('header--home');
  renderHomeHeader();
  renderTripList();
}

function showTripView(tripId: string): void {
  setActiveTrip(tripId);
  el('#view-home').hidden = true;
  el('#view-trip').hidden = false;
  el('.header').classList.remove('header--home');
  el('.header').classList.add('header--trip');
  renderTripHeader(tripId);

  if (!tripViewBooted) {
    initTabs();
    initPeopleForm();
    initExpenseForm();

    el('#select-currency').addEventListener('change', (e) => {
      setCurrency((e.target as HTMLSelectElement).value);
      renderPeople();
      const activeTab = document.querySelector<HTMLButtonElement>('.tabs__btn--active')?.dataset.tab;
      if (activeTab === 'expenses') renderExpensesList();
      if (activeTab === 'settle') renderSettle();
    });

    tripViewBooted = true;
  }

  // Sync currency selector to this trip's currency
  el<HTMLSelectElement>('#select-currency').value = getState().currency;

  renderPeople();
  renderExpenseForm();
}

// ---------------------------------------------------------------------------
// Home header
// ---------------------------------------------------------------------------

function renderHomeHeader(): void {
  const inner = el<HTMLElement>('.header__inner');
  inner.innerHTML = `
    <section class="hero">
      <div class="hero__brand">
        <span class="hero__logo">⛺</span>
        <span class="hero__name">ShoutMate</span>
      </div>
      <div class="hero__bubbles" aria-hidden="true">
        <span class="hero__bubble hero__bubble--1">✈️</span>
        <span class="hero__bubble hero__bubble--2">🏖️</span>
        <span class="hero__bubble hero__bubble--3">🗺️</span>
        <span class="hero__bubble hero__bubble--4">🏔️</span>
        <span class="hero__bubble hero__bubble--5">🧳</span>
      </div>
      <div class="hero__accent"></div>
      <h1 class="hero__heading">Trips sorted.<br/>Mates still mates.</h1>
      <p class="hero__sub">Track shared expenses as you go and settle up in seconds.</p>
      <p class="hero__sub">No accounts. No awkward money chats. Just a fair shout.</p>
    </section>`;
}

// ---------------------------------------------------------------------------
// Trip header
// ---------------------------------------------------------------------------

function renderTripHeader(tripId: string): void {
  const trip = getTrip(tripId)!;
  const inner = el<HTMLElement>('.header__inner');

  inner.innerHTML = `
    <div class="header__brand-bar">
      <span class="header__logo">⛺</span>
      <span class="header__brand-name">ShoutMate</span>
      <button class="btn btn--share" id="btn-share">🔗 Share</button>
    </div>
    <div class="header__trip-row">
      <h2 class="header__trip-name" id="trip-name-display" title="Click to rename">${escapeHtml(trip.name)}</h2>
      <button class="btn btn--back" id="btn-back">← Back to trips</button>
    </div>`;

  el('#btn-back').addEventListener('click', () => navigate(''));

  el('#btn-share').addEventListener('click', async () => {
    const shareUrl = encodeTripToShareUrl(getTrip(tripId)!);
    try {
      await copyToClipboard(shareUrl);
      showToast('Share link copied to clipboard!');
    } catch {
      prompt('Copy this share link:', shareUrl);
    }
  });

  el<HTMLElement>('#trip-name-display').addEventListener('click', () => {
    startTripRename(tripId);
  });
}

function startTripRename(tripId: string): void {
  const display = el<HTMLElement>('#trip-name-display');
  const current = getTrip(tripId)!.name;

  display.outerHTML = `<input class="header__trip-name header__trip-name--editing" id="trip-name-input" type="text" value="${escapeHtml(current)}" maxlength="60" />`;

  const input = el<HTMLInputElement>('#trip-name-input');
  input.focus();
  input.select();

  function commit(): void {
    const newName = input.value.trim() || current;
    renameTrip(tripId, newName);
    renderTripHeader(tripId);
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = current; input.blur(); }
  });
}

// ---------------------------------------------------------------------------
// Toast notification
// ---------------------------------------------------------------------------

function showToast(message: string): void {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ---------------------------------------------------------------------------
// Home view – trip list
// ---------------------------------------------------------------------------

function renderTripList(): void {
  const trips = listTrips();
  const container = el<HTMLElement>('#home-content');

  const tripListHtml =
    trips.length === 0
      ? `<div class="empty-state">
          <span class="empty-state__icon">🏕️</span>
          <p>No trips yet. Create your first one above!</p>
        </div>`
      : `<div class="card">
          <h2 class="card__title">Your trips</h2>
          <ul class="trip-list">
            ${trips
              .map((t) => {
                const peopleCount = t.state.participants.length;
                const expenseCount = t.state.expenses.length;
                const total = totalExpenses(t.state.expenses);
                const totalFormatted = expenseCount > 0
                  ? new Intl.NumberFormat(undefined, {
                      style: 'currency',
                      currency: t.state.currency,
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(total)
                  : null;
                const date = new Date(t.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                return `
                <li class="trip-card" data-id="${t.id}" role="button" tabindex="0">
                  <div class="trip-card__body">
                    <span class="trip-card__name">${escapeHtml(t.name)}</span>
                    <span class="trip-card__meta">
                      ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}
                      · ${expenseCount} ${expenseCount === 1 ? 'expense' : 'expenses'}
                      ${totalFormatted ? `· ${totalFormatted} total` : ''}
                      · Created ${date}
                    </span>
                  </div>
                  <div class="trip-card__actions">
                    <button class="btn btn--ghost btn--sm trip-card__delete" data-id="${t.id}" aria-label="Delete ${escapeHtml(t.name)}">✕</button>
                  </div>
                </li>`;
              })
              .join('')}
          </ul>
        </div>`;

  container.innerHTML = tripListHtml;

  // Click to open trip
  container.querySelectorAll<HTMLElement>('.trip-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.trip-card__delete')) return;
      navigate(card.dataset.id!);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigate(card.dataset.id!);
      }
    });
  });

  // Delete trip
  container.querySelectorAll<HTMLButtonElement>('.trip-card__delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id!;
      const trip = getTrip(id);
      if (trip && confirm(`Delete "${trip.name}"? This cannot be undone.`)) {
        deleteTrip(id);
        renderTripList();
      }
    });
  });
}

function initCreateTripForm(): void {
  const form = el<HTMLFormElement>('#form-create-trip');
  const input = el<HTMLInputElement>('#input-trip-name');
  const errorEl = el<HTMLElement>('#error-trip-name');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const name = input.value.trim();

    if (!name) {
      errorEl.textContent = 'Please enter a trip name.';
      input.focus();
      return;
    }

    const trip = createTrip(name);
    input.value = '';
    navigate(trip.id);
  });
}

// ---------------------------------------------------------------------------
// Share import view
// ---------------------------------------------------------------------------

function handleShareImport(payload: string): void {
  const decoded = decodeTripFromPayload(payload);

  if (!decoded) {
    showHomeView();
    showToast('Invalid share link.');
    return;
  }

  el('#view-home').hidden = false;
  el('#view-trip').hidden = true;
  el('.header').classList.remove('header--trip');
  el('.header').classList.add('header--home');
  renderHomeHeader();

  const total = totalExpenses(decoded.state.expenses);
  const totalFormatted = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: decoded.state.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(total);

  const container = el<HTMLElement>('#home-content');
  container.innerHTML = `
    <div class="card import-card">
      <div class="import-card__icon">🔗</div>
      <h2 class="card__title">Trip invite</h2>
      <p class="import-card__name">${escapeHtml(decoded.name)}</p>
      <ul class="import-card__stats">
        <li>${decoded.state.participants.length} ${decoded.state.participants.length === 1 ? 'person' : 'people'}</li>
        <li>${decoded.state.expenses.length} ${decoded.state.expenses.length === 1 ? 'expense' : 'expenses'}</li>
        <li>${totalFormatted} total</li>
      </ul>
      <div class="import-card__actions">
        <button class="btn btn--primary btn--full" id="btn-import-trip">Save to my trips</button>
        <button class="btn btn--ghost btn--full" id="btn-dismiss-import">Go to my trips</button>
      </div>
    </div>`;

  el('#btn-import-trip').addEventListener('click', () => {
    const local = importTrip(decoded);
    navigate(local.id);
  });

  el('#btn-dismiss-import').addEventListener('click', () => navigate(''));
}

// ---------------------------------------------------------------------------
// Tab navigation
// ---------------------------------------------------------------------------

function initTabs(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.tabs__btn');
  const panels = document.querySelectorAll<HTMLElement>('.panel');

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      buttons.forEach((b) => {
        b.classList.remove('tabs__btn--active');
        b.setAttribute('aria-selected', 'false');
      });
      panels.forEach((p) => {
        p.classList.remove('panel--active');
        p.hidden = true;
      });

      btn.classList.add('tabs__btn--active');
      btn.setAttribute('aria-selected', 'true');

      const panel = document.getElementById(`panel-${target}`);
      if (panel) {
        panel.classList.add('panel--active');
        panel.hidden = false;
      }

      if (target === 'expenses') renderExpenseForm();
      if (target === 'settle') renderSettle();
    });
  });
}

// ---------------------------------------------------------------------------
// People tab
// ---------------------------------------------------------------------------

function renderPeople(): void {
  const { participants, expenses } = getState();
  const list = el<HTMLElement>('#people-list');

  if (participants.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__icon">👤</span>
        <p>No one added yet. Start by adding your group.</p>
      </div>`;
    return;
  }

  const balances = calculateBalances(participants, expenses);

  list.innerHTML = `
    <div class="card">
      <h2 class="card__title">Group (${participants.length})</h2>
      <ul class="people-list__items">
        ${participants
          .map((p) => {
            const balance = balances.get(p.id) ?? 0;
            const balanceClass =
              balance > 0.005 ? 'balance--positive'
              : balance < -0.005 ? 'balance--negative'
              : 'balance--neutral';
            const balanceLabel =
              balance > 0.005 ? `+${formatCurrency(balance)}`
              : balance < -0.005 ? formatCurrency(balance)
              : 'settled';
            return `
            <li class="person-item" data-id="${p.id}">
              <div class="person-item__avatar">${p.name.charAt(0).toUpperCase()}</div>
              <span class="person-item__name">${escapeHtml(p.name)}</span>
              ${expenses.length > 0 ? `<span class="balance ${balanceClass}">${balanceLabel}</span>` : ''}
              <button class="btn btn--ghost btn--sm person-item__remove" data-id="${p.id}" aria-label="Remove ${escapeHtml(p.name)}">✕</button>
            </li>`;
          })
          .join('')}
      </ul>
    </div>`;

  list.querySelectorAll<HTMLButtonElement>('.person-item__remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id!;
      const { participants: pp } = getState();
      const person = pp.find((p) => p.id === id);
      if (person && confirm(`Remove ${person.name}? Any expenses they paid will also be removed.`)) {
        removeParticipant(id);
        renderPeople();
        renderExpenseForm();
      }
    });
  });
}

function initPeopleForm(): void {
  const form = el<HTMLFormElement>('#form-add-person');
  const input = el<HTMLInputElement>('#input-person-name');
  const errorEl = el<HTMLElement>('#error-person-name');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const name = input.value.trim();

    if (!name) {
      errorEl.textContent = 'Please enter a name.';
      input.focus();
      return;
    }

    const { participants } = getState();
    if (participants.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      errorEl.textContent = 'That name is already in the group.';
      input.focus();
      return;
    }

    addParticipant(name);
    input.value = '';
    input.focus();
    renderPeople();
    renderExpenseForm();
  });
}

// ---------------------------------------------------------------------------
// Expenses tab
// ---------------------------------------------------------------------------

function renderExpenseForm(): void {
  const { participants } = getState();
  const noPeopleMsg = el<HTMLElement>('#expenses-no-people');
  const form = el<HTMLFormElement>('#form-add-expense');
  const paidBySelect = el<HTMLSelectElement>('#input-expense-paid-by');
  const checkboxContainer = el<HTMLElement>('#split-among-checkboxes');

  if (participants.length === 0) {
    noPeopleMsg.hidden = false;
    form.hidden = true;
    return;
  }

  noPeopleMsg.hidden = true;
  form.hidden = false;

  paidBySelect.innerHTML =
    `<option value="">Select person</option>` +
    participants.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');

  checkboxContainer.innerHTML = participants
    .map(
      (p) => `
      <label class="checkbox-label">
        <input type="checkbox" name="splitAmong" value="${p.id}" checked />
        <span>${escapeHtml(p.name)}</span>
      </label>`
    )
    .join('');

  renderExpensesList();
}

function renderExpensesList(): void {
  const { participants, expenses } = getState();
  const list = el<HTMLElement>('#expenses-list');
  const nameMap = new Map(participants.map((p) => [p.id, p.name]));

  if (expenses.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__icon">💳</span>
        <p>No expenses yet. Add your first one above.</p>
      </div>`;
    return;
  }

  const total = totalExpenses(expenses);

  list.innerHTML = `
    <div class="card">
      <div class="card__header">
        <h2 class="card__title">Expenses</h2>
        <span class="card__badge">${formatCurrency(total)} total</span>
      </div>
      <ul class="expense-list__items">
        ${expenses
          .map((expense) => {
            const paidByName = nameMap.get(expense.paidById) ?? 'Unknown';
            const splitNames = expense.splitAmongIds
              .map((id) => nameMap.get(id) ?? 'Unknown')
              .join(', ');
            const perPerson = expense.amount / expense.splitAmongIds.length;
            return `
            <li class="expense-item" data-id="${expense.id}">
              <div class="expense-item__body">
                <span class="expense-item__desc">${escapeHtml(expense.description)}</span>
                <span class="expense-item__amount">${formatCurrency(expense.amount)}</span>
              </div>
              <div class="expense-item__meta">
                <span>Paid by <strong>${escapeHtml(paidByName)}</strong></span>
                <span class="expense-item__split">
                  ${formatCurrency(perPerson)}/person · Split: ${escapeHtml(splitNames)}
                </span>
              </div>
              <button class="btn btn--ghost btn--sm expense-item__remove" data-id="${expense.id}" aria-label="Remove expense">✕</button>
            </li>`;
          })
          .join('')}
      </ul>
    </div>`;

  list.querySelectorAll<HTMLButtonElement>('.expense-item__remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      removeExpense(btn.dataset.id!);
      renderExpensesList();
      renderPeople();
    });
  });
}

function initExpenseForm(): void {
  const form = el<HTMLFormElement>('#form-add-expense');
  const errorEl = el<HTMLElement>('#error-expense');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const desc = (form.elements.namedItem('description') as HTMLInputElement).value.trim();
    const amountRaw = parseFloat(
      (form.elements.namedItem('amount') as HTMLInputElement).value
    );
    const paidById = (form.elements.namedItem('paidById') as HTMLSelectElement).value;
    const checked = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[name="splitAmong"]:checked')
    ).map((cb) => cb.value);

    if (!desc) { errorEl.textContent = 'Please enter a description.'; return; }
    if (isNaN(amountRaw) || amountRaw <= 0) { errorEl.textContent = 'Please enter a valid amount greater than zero.'; return; }
    if (!paidById) { errorEl.textContent = 'Please select who paid.'; return; }
    if (checked.length === 0) { errorEl.textContent = 'Please select at least one person to split among.'; return; }

    addExpense({
      description: desc,
      amount: Math.round(amountRaw * 100) / 100,
      paidById,
      splitAmongIds: checked,
    });

    form.reset();
    renderExpenseForm();
    renderPeople();
  });
}

// ---------------------------------------------------------------------------
// Settle tab
// ---------------------------------------------------------------------------

function renderSettle(): void {
  const { participants, expenses } = getState();
  const container = el<HTMLElement>('#settle-summary');

  if (participants.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__icon">🏕️</span>
        <p>Add people and expenses to see how to settle up.</p>
      </div>`;
    return;
  }

  if (expenses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__icon">💸</span>
        <p>No expenses logged yet. Add some expenses first.</p>
      </div>`;
    return;
  }

  const settlements = calculateSettlements(participants, expenses);
  const balances = calculateBalances(participants, expenses);
  const total = totalExpenses(expenses);
  const nameMap = new Map(participants.map((p) => [p.id, p.name]));

  container.innerHTML = `
    <div class="card">
      <div class="card__header">
        <h2 class="card__title">Summary</h2>
        <span class="card__badge">${formatCurrency(total)} total</span>
      </div>
      <ul class="balance-list">
        ${participants
          .map((p) => {
            const balance = balances.get(p.id) ?? 0;
            const balanceClass =
              balance > 0.005 ? 'balance--positive'
              : balance < -0.005 ? 'balance--negative'
              : 'balance--neutral';
            const balanceLabel =
              balance > 0.005 ? `is owed ${formatCurrency(balance)}`
              : balance < -0.005 ? `owes ${formatCurrency(-balance)}`
              : 'is settled up';
            return `
            <li class="balance-item">
              <div class="person-item__avatar">${p.name.charAt(0).toUpperCase()}</div>
              <span class="balance-item__name">${escapeHtml(p.name)}</span>
              <span class="balance ${balanceClass}">${balanceLabel}</span>
            </li>`;
          })
          .join('')}
      </ul>
    </div>

    ${settlements.length === 0
      ? `<div class="card settle-done">
          <span class="settle-done__icon">🎉</span>
          <p>Everyone is settled up!</p>
        </div>`
      : `<div class="card">
          <h2 class="card__title">Payments to make</h2>
          <ul class="settlement-list">
            ${settlements
              .map(
                (s) => `
              <li class="settlement-item">
                <div class="settlement-item__avatars">
                  <div class="person-item__avatar person-item__avatar--sm">${nameMap.get(s.fromId)?.charAt(0).toUpperCase() ?? '?'}</div>
                  <span class="settlement-item__arrow">→</span>
                  <div class="person-item__avatar person-item__avatar--sm">${nameMap.get(s.toId)?.charAt(0).toUpperCase() ?? '?'}</div>
                </div>
                <div class="settlement-item__detail">
                  <span><strong>${escapeHtml(s.fromName)}</strong> pays <strong>${escapeHtml(s.toName)}</strong></span>
                  <span class="settlement-item__amount">${formatCurrency(s.amount)}</span>
                </div>
              </li>`
              )
              .join('')}
          </ul>
        </div>`}`;

  void nameMap;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function init(): void {
  initCreateTripForm();
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

init();
