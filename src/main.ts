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
import { S } from './strings';
// ---------------------------------------------------------------------------
// Avatar colours — cycling palette of gradients
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  'linear-gradient(135deg, #1e72c8 0%, #5aadf0 100%)',   // blue
  'linear-gradient(135deg, #7c3aed 0%, #c084fc 100%)',   // purple
  'linear-gradient(135deg, #e05c2a 0%, #f59460 100%)',   // orange
  'linear-gradient(135deg, #0e9f6e 0%, #6ee7b7 100%)',   // green
  'linear-gradient(135deg, #e53e5e 0%, #f9a8bc 100%)',   // pink
  'linear-gradient(135deg, #d97706 0%, #fcd34d 100%)',   // amber
  'linear-gradient(135deg, #0891b2 0%, #67e8f9 100%)',   // cyan
  'linear-gradient(135deg, #be185d 0%, #f0abca 100%)',   // rose
];

function avatarStyle(participantId: string): string {
  const { participants } = getState();
  const index = participants.findIndex((p) => p.id === participantId);
  const gradient = AVATAR_COLORS[(index < 0 ? 0 : index) % AVATAR_COLORS.length];
  return `style="background: ${gradient}; box-shadow: none;"`;
}

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
// Theme
// ---------------------------------------------------------------------------

function initTheme(): void {
  const saved = localStorage.getItem('shoutmate_theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  updateThemeToggles();
}

function toggleTheme(): void {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('shoutmate_theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('shoutmate_theme', 'dark');
  }
  updateThemeToggles();
}

function updateThemeToggles(): void {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.querySelectorAll<HTMLButtonElement>('.theme-toggle').forEach((btn) => {
    btn.textContent = isDark ? S.lightMode : S.darkMode;
    btn.setAttribute('aria-label', isDark ? S.switchToLightMode : S.switchToDarkMode);
  });
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

let tripViewBooted = false;

function handleRoute(): void {
  const route = parseRoute(window.location.hash);

  if (route.view === 'share') {
    void handleShareImport(route.payload);
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

  const defaultCurrency = localStorage.getItem('shoutmate_default_currency') ?? 'AUD';
  el<HTMLSelectElement>('#home-select-currency').value = defaultCurrency;
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
        <span class="hero__name">${S.appName}</span>
      </div>
      <div class="hero__bubbles" aria-hidden="true">
        <span class="hero__bubble hero__bubble--1">🏔️</span>
        <span class="hero__bubble hero__bubble--2">🏖️</span>
        <span class="hero__bubble hero__bubble--3">🗺️</span>
        <span class="hero__bubble hero__bubble--4">⛳️</span>
        <span class="hero__bubble hero__bubble--5">🧳</span>
      </div>
      <div class="hero__accent"></div>
      <h1 class="hero__heading">${S.heroHeading}</h1>
      <p class="hero__sub">${S.heroSub1}</p>
      <p class="hero__sub">${S.heroSub2}</p>
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
      <button class="header__brand-home" id="btn-brand-home">
        <span class="header__logo">⛺</span>
        <span class="header__brand-name">${S.appName}</span>
      </button>
      <button class="btn btn--share" id="btn-share">${S.shareBtn}</button>
    </div>
    <div class="header__trip-row">
      <h2 class="header__trip-name" id="trip-name-display" title="${S.clickToRename}">${escapeHtml(trip.name)}</h2>
      <button class="btn btn--back" id="btn-back">${S.backToTrips}</button>
    </div>`;

  el('#btn-brand-home').addEventListener('click', () => {
    window.location.hash = '/';
  });

  el('#btn-back').addEventListener('click', () => {
    window.location.hash = '/';
  });

  el('#btn-share').addEventListener('click', async () => {
    const shareUrl = await encodeTripToShareUrl(getTrip(tripId)!);
    try {
      await copyToClipboard(shareUrl);
      showToast(S.shareCopied);
    } catch {
      prompt(S.copyShareLinkPrompt, shareUrl);
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
          <p>${S.noTripsYet}</p>
        </div>`
      : `<div class="card">
          <h2 class="card__title">${S.yourTrips}</h2>
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
                      ${peopleCount} ${peopleCount === 1 ? S.person : S.people}
                      · ${expenseCount} ${expenseCount === 1 ? S.expense : S.expenses}
                      ${totalFormatted ? `· ${totalFormatted} ${S.total}` : ''}
                      · ${S.created} ${date}
                    </span>
                  </div>
                  <div class="trip-card__actions">
                    <button class="btn btn--ghost btn--sm trip-card__delete" data-id="${t.id}" aria-label="${S.ariaDeleteTrip(t.name)}">✕</button>
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
      if (trip && confirm(S.confirmDeleteTrip(trip.name))) {
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
      errorEl.textContent = S.errorTripNameRequired;
      input.focus();
      return;
    }

    const trip = createTrip(name);
    input.value = '';
    const defaultCurrency = localStorage.getItem('shoutmate_default_currency') ?? 'AUD';
    setActiveTrip(trip.id);
    setCurrency(defaultCurrency);
    navigate(trip.id);
  });
}

// ---------------------------------------------------------------------------
// Share import view
// ---------------------------------------------------------------------------

async function handleShareImport(payload: string): Promise<void> {
  const decoded = await decodeTripFromPayload(payload);

  if (!decoded) {
    showHomeView();
    showToast(S.invalidShareLink);
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
      <h2 class="card__title">${S.tripInvite}</h2>
      <p class="import-card__name">${escapeHtml(decoded.name)}</p>
      <ul class="import-card__stats">
        <li>${decoded.state.participants.length} ${decoded.state.participants.length === 1 ? S.person : S.people}</li>
        <li>${decoded.state.expenses.length} ${decoded.state.expenses.length === 1 ? S.expense : S.expenses}</li>
        <li>${totalFormatted} ${S.total}</li>
      </ul>
      <div class="import-card__actions">
        <button class="btn btn--primary btn--full" id="btn-import-trip">${S.saveToMyTrips}</button>
        <button class="btn btn--ghost btn--full" id="btn-dismiss-import">${S.goToMyTrips}</button>
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
        <p>${S.noOneYet}</p>
      </div>`;
    return;
  }

  const balances = calculateBalances(participants, expenses);

  list.innerHTML = `
    <div class="card">
      <h2 class="card__title">${S.group(participants.length)}</h2>
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
              : S.settled;
            return `
            <li class="person-item" data-id="${p.id}">
              <div class="person-item__avatar" ${avatarStyle(p.id)}>${p.name.charAt(0).toUpperCase()}</div>
              <span class="person-item__name">${escapeHtml(p.name)}</span>
              ${expenses.length > 0 ? `<span class="balance ${balanceClass}">${balanceLabel}</span>` : ''}
              <button class="btn btn--ghost btn--sm person-item__remove" data-id="${p.id}" aria-label="${S.ariaRemovePerson(p.name)}">✕</button>
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
      if (person && confirm(S.confirmRemovePerson(person.name))) {
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
      errorEl.textContent = S.errorNameRequired;
      input.focus();
      return;
    }

    const { participants } = getState();
    if (participants.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      errorEl.textContent = S.errorNameDuplicate;
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
    `<option value="">${S.selectPerson}</option>` +
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
        <p>${S.noExpensesYet}</p>
      </div>`;
    return;
  }

  const total = totalExpenses(expenses);

  list.innerHTML = `
    <div class="card">
      <div class="card__header">
        <h2 class="card__title">${S.expensesTitle}</h2>
        <span class="card__badge">${formatCurrency(total)} ${S.total}</span>
      </div>
      <ul class="expense-list__items">
        ${expenses
          .map((expense) => {
            const paidByName = nameMap.get(expense.paidById) ?? S.unknown;
            const splitNames = expense.splitAmongIds
              .map((id) => nameMap.get(id) ?? S.unknown)
              .join(', ');
            const perPerson = expense.amount / expense.splitAmongIds.length;
            return `
            <li class="expense-item" data-id="${expense.id}">
              <div class="expense-item__body">
                <span class="expense-item__desc">${escapeHtml(expense.description)}</span>
                <span class="expense-item__amount">${formatCurrency(expense.amount)}</span>
              </div>
              <div class="expense-item__meta">
                <span>${S.paidBy} <strong>${escapeHtml(paidByName)}</strong></span>
                <span class="expense-item__split">
                  ${formatCurrency(perPerson)}${S.perPersonSuffix} · ${S.split} ${escapeHtml(splitNames)}
                </span>
              </div>
              <button class="btn btn--ghost btn--sm expense-item__remove" data-id="${expense.id}" aria-label="${S.ariaRemoveExpense}">✕</button>
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

    if (!desc) { errorEl.textContent = S.errorDescRequired; return; }
    if (isNaN(amountRaw) || amountRaw <= 0) { errorEl.textContent = S.errorAmountInvalid; return; }
    if (!paidById) { errorEl.textContent = S.errorPaidByRequired; return; }
    if (checked.length === 0) { errorEl.textContent = S.errorSplitRequired; return; }

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
        <p>${S.settleNoPeople}</p>
      </div>`;
    return;
  }

  if (expenses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__icon">💸</span>
        <p>${S.settleNoExpenses}</p>
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
        <h2 class="card__title">${S.summaryTitle}</h2>
        <span class="card__badge">${formatCurrency(total)} ${S.total}</span>
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
              balance > 0.005 ? S.isOwed(formatCurrency(balance))
              : balance < -0.005 ? S.owes(formatCurrency(-balance))
              : S.isSettledUp;
            return `
            <li class="balance-item">
              <div class="person-item__avatar" ${avatarStyle(p.id)}>${p.name.charAt(0).toUpperCase()}</div>
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
          <p>${S.settledUp}</p>
        </div>`
      : `<div class="card">
          <h2 class="card__title">${S.paymentsTitle}</h2>
          <ul class="settlement-list">
            ${settlements
              .map(
                (s) => `
              <li class="settlement-item">
                <div class="settlement-item__avatars">
                  <div class="person-item__avatar person-item__avatar--sm" ${avatarStyle(s.fromId)}>${nameMap.get(s.fromId)?.charAt(0).toUpperCase() ?? '?'}</div>
                  <span class="settlement-item__arrow">→</span>
                  <div class="person-item__avatar person-item__avatar--sm" ${avatarStyle(s.toId)}>${nameMap.get(s.toId)?.charAt(0).toUpperCase() ?? '?'}</div>
                </div>
                <div class="settlement-item__detail">
                  <span><strong>${escapeHtml(s.fromName)}</strong> ${S.pays} <strong>${escapeHtml(s.toName)}</strong></span>
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

// ---------------------------------------------------------------------------
// Footer component
// ---------------------------------------------------------------------------

const CURRENCY_OPTIONS = `
  <option value="AUD">🇦🇺 AUD</option>
  <option value="USD">🇺🇸 USD</option>
  <option value="EUR">🇪🇺 EUR</option>
  <option value="GBP">🇬🇧 GBP</option>
  <option value="NZD">🇳🇿 NZD</option>
  <option value="CAD">🇨🇦 CAD</option>
  <option value="JPY">🇯🇵 JPY</option>
  <option value="SGD">🇸🇬 SGD</option>`;

function buildFooter(currencySelectId: string, currencyAriaLabel: string): string {
  return `
    <footer class="trip-footer">
      <div class="trip-footer__inner">
        <p class="trip-footer__copy">${S.appTagline}</p>
        <div class="trip-footer__right">
          <div class="trip-footer__currency">
            <label class="trip-footer__label" for="${currencySelectId}">${S.currencyLabel}</label>
            <select class="trip-footer__select" id="${currencySelectId}" aria-label="${currencyAriaLabel}">
              ${CURRENCY_OPTIONS}
            </select>
          </div>
          <button class="theme-toggle" aria-label="${S.toggleDarkModeAriaLabel}">🌙</button>
        </div>
      </div>
    </footer>`;
}

function initStaticStrings(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((node) => {
    const key = node.dataset.i18n as keyof typeof S;
    const val = S[key];
    if (typeof val === 'string') node.textContent = val;
  });
  document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((node) => {
    const key = node.dataset.i18nPlaceholder as keyof typeof S;
    const val = S[key];
    if (typeof val === 'string') node.placeholder = val;
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((node) => {
    const key = node.dataset.i18nAria as keyof typeof S;
    const val = S[key];
    if (typeof val === 'string') node.setAttribute('aria-label', val);
  });
}

function init(): void {
  // Inject footer components before any event wiring
  el('#footer-mount-home').outerHTML = buildFooter('home-select-currency', S.defaultCurrencyAriaLabel);
  el('#footer-mount-trip').outerHTML = buildFooter('select-currency', S.selectCurrencyAriaLabel);

  initStaticStrings();
  initTheme();

  document.querySelectorAll('.theme-toggle').forEach((btn) => {
    btn.addEventListener('click', toggleTheme);
  });

  // Home footer currency — saves default preference
  el('#home-select-currency').addEventListener('change', (e) => {
    localStorage.setItem('shoutmate_default_currency', (e.target as HTMLSelectElement).value);
  });

  initCreateTripForm();
  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('popstate', handleRoute);
  handleRoute();
}

init();
