export const S = {
  // App identity
  appName: 'ShoutMate',
  appTagline: 'Built in Australia 🇦🇺',

  // Hero
  heroHeading: 'Trips sorted.<br/>Mates still mates.',
  heroSub1: 'Track shared expenses as you go and settle up in seconds.',
  heroSub2: 'No accounts. No awkward money chats. Just a fair shout.',

  // Tabs
  tabPeople: 'People',
  tabExpenses: 'Expenses',
  tabSettleUp: 'Settle Up',

  // Trip list (home)
  newTrip: 'New trip',
  tripNamePlaceholder: 'e.g. Golf Trip, Lake House...',
  createBtn: 'Create',
  yourTrips: 'Your trips',
  noTripsYet: 'Create your first trip above!',
  errorTripNameRequired: 'Please enter a trip name.',
  confirmDeleteTrip: (name: string) => `Delete "${name}"? This cannot be undone.`,
  person: 'person',
  people: 'people',
  expense: 'expense',
  expenses: 'expenses',
  created: 'Created',
  total: 'total',

  // Trip header
  backToTrips: '← Back to trips',
  shareBtn: '🔗 Share',
  shareCopied: 'Share link copied to clipboard!',
  copyShareLinkPrompt: 'Copy this share link:',
  clickToRename: 'Click to rename',

  // People tab
  whoComing: "Who's coming?",
  nameLabel: 'Name',
  personNamePlaceholder: 'e.g. Alex',
  addPersonBtn: 'Add',
  addPersonAriaLabel: 'Add person',
  noOneYet: 'No one added yet. Start by adding your group.',
  errorNameRequired: 'Please enter a name.',
  errorNameDuplicate: 'That name is already in the group.',
  confirmRemovePerson: (name: string) => `Remove ${name}? Any expenses they paid will also be removed.`,
  group: (count: number) => `Group (${count})`,
  settled: 'settled',
  ariaRemovePerson: (name: string) => `Remove ${name}`,

  // Expenses tab
  addExpenseTitle: 'Add an expense',
  noPeopleForExpenses: 'Add some people first before logging expenses.',
  descriptionLabel: 'Description',
  expenseDescPlaceholder: 'e.g. Groceries, Airbnb, Petrol...',
  amountLabel: 'Amount',
  paidByLabel: 'Paid by',
  paidBy: 'Paid by',
  splitAmongLabel: 'Split among',
  selectPerson: 'Select person',
  addExpenseBtn: 'Add Expense',
  noExpensesYet: 'No expenses yet. Add your first one above.',
  expensesTitle: 'Expenses',
  split: 'Split:',
  perPersonSuffix: '/person',
  unknown: 'Unknown',
  ariaRemoveExpense: 'Remove expense',
  errorDescRequired: 'Please enter a description.',
  errorAmountInvalid: 'Please enter a valid amount greater than zero.',
  errorPaidByRequired: 'Please select who paid.',
  errorSplitRequired: 'Please select at least one person to split among.',

  // Settle tab
  settleNoPeople: 'Add people and expenses to see how to settle up.',
  settleNoExpenses: 'No expenses logged yet. Add some expenses first.',
  summaryTitle: 'Summary',
  paymentsTitle: 'Payments to make',
  settledUp: 'Everyone is settled up!',
  isOwed: (amt: string) => `is owed ${amt}`,
  owes: (amt: string) => `owes ${amt}`,
  isSettledUp: 'is settled up',
  pays: 'pays',

  // Share import
  sharedVia: 'Shared via ShoutMate ⛺',
  tripInvite: 'Trip invite',
  saveToMyTrips: 'Save to my trips',
  goToMyTrips: 'Go to my trips',
  invalidShareLink: 'Invalid share link.',

  // Aria labels
  ariaDeleteTrip: (name: string) => `Delete ${name}`,
  addPersonAriaLabelFn: (name: string) => `Remove ${name}`,
  toggleDarkModeAriaLabel: 'Toggle dark mode',
  switchToLightMode: 'Switch to light mode',
  switchToDarkMode: 'Switch to dark mode',
  defaultCurrencyAriaLabel: 'Default currency',
  selectCurrencyAriaLabel: 'Select currency',

  // Footer
  currencyLabel: 'Currency',
  privacyBtn: 'Privacy Policy',

  // Theme
  lightMode: '☀️',
  darkMode: '🌙',
};
