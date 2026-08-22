/**
 * User-visible English copy. Components read from here so a later locale is
 * a dictionary swap, not a hunt through JSX.
 */
export const copy = {
  page: {
    title: 'Move your account',
    lede:
      'Take your handle, your posts and your followers from one server to another. Your account keeps the same identity the whole way, so the move is reversible — the same tool brings you back.',
    footnote:
      'This runs the standard atproto account migration: your repository is exported, imported, and your identity record is re-pointed with a code only you can approve. Nothing is deleted from the server you leave.',
  },
  direction: {
    heading: 'Direction',
    fromRole: 'Moving from',
    toRole: 'Moving to',
    swap: (to: string, from: string) => `Swap: move from ${to} to ${from} instead`,
    swapTitle: 'Reverse the direction',
    search: (n: number) => `Search ${n.toLocaleString()} servers, or type any hostname`,
    searchAria: 'Search servers',
    listFrom: 'Server to move from',
    listTo: 'Server to move to',
    searching: 'Searching…',
    empty: 'No server matches that. A full hostname works too.',
    typedHint: 'use this hostname',
    checking: 'checking…',
    notAnswering: 'not answering',
    inviteOnly: 'invite only',
    notAnsweringHost: (host: string) => `${host} — not answering`,
  },
  setup: {
    whatComes: 'What comes with you',
    signIn: (label: string) => `Sign in to ${label}`,
    identifier: (label: string) => `Handle or email on ${label}`,
    password: 'Account password',
    passwordHelp: (label: string) =>
      `This has to be your real account password. App passwords are not allowed to move an account, so ${label} will refuse one.`,
    lookingUp: 'Looking up where your account lives…',
    foundOn: (label: string, host: string, named: boolean) =>
      named ? `Found on ${label} (${host})` : `Found on ${label}`,
    didWebNote: ' — a did:web identity, so you publish the final change yourself',
    alreadyThere: (label: string) =>
      `This account already lives on ${label}. Use the swap button if you meant to move it away.`,
    readOnly:
      'Signing in only reads your account at this stage. You will see exactly what is about to move, and can walk away, before anything changes.',
    advanced: 'Advanced',
    keepActive: (label: string) => `Leave my ${label} account active`,
    keepActiveHelp:
      'Normally the old account is deactivated once the move succeeds — its data is kept, it just stops serving. Only two servers claiming the same account at once causes confusion, so leave this off unless you know why you want it.',
    submit: 'Check my account',
    submitting: 'Checking…',
    nothingMoves: 'Nothing moves yet.',
  },
  blocker: {
    yourTurn: 'Your turn',
    working: 'Working…',
    checking: 'Checking…',
    codeCta: 'Continue',
    plcCta: 'Point my identity at the new server',
    plcFooter: (label: string) =>
      `This is the step that actually moves you. After it, the network resolves your handle to ${label}. You can always come back later — it is the same operation in reverse, not a rebuild.`,
    destTitle: (label: string) => `Your account on ${label}`,
    destHandle: (label: string) => `Handle on ${label}`,
    destEmail: 'Email for the new account',
    destPassword: 'Password for the new account',
    destPasswordHelp: 'At least 8 characters. This is separate from your old account’s password.',
    destInvite: 'Invite code',
    destInviteHelp: (label: string) => `${label} is invite-only right now.`,
    destSubmit: 'Create it and move my data',
    destStillReversible: 'Still reversible after this.',
    didWebTitle: 'Publish your identity document',
    copyDocument: 'Copy document',
    published: 'I have published it',
  },
  outcome: {
    stopped: 'Stopped',
    canceledSafe: (label: string) =>
      `The migration was canceled. Your account never left ${label}, so there is nothing to undo.`,
    canceledMoved:
      'The migration was canceled. Your identity had already moved, so check the state of both accounts before trying again.',
    startOver: 'Start over',
    done: 'Done',
    doneWithNotes: 'Moved, with notes',
  },
} as const
