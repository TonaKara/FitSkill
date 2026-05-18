/** 取引チャット・相談チャット等で共有するセマンティッククラス */
export const chatUi = {
  page: "bg-background text-foreground",
  loading: "text-muted-foreground",
  muted: "text-muted-foreground",
  mutedXs: "text-xs text-muted-foreground",
  headerName: "truncate font-semibold text-foreground",
  ghostBtn: "shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground",
  avatarBorder: "border border-border",
  otherBubble: "border border-border bg-muted text-foreground",
  input:
    "border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-red-500",
  outlineBtn:
    "border-border bg-background text-foreground hover:border-primary hover:bg-muted",
  modalOverlay: "fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4",
  modalOverlayHigh: "fixed inset-0 z-[10000] flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-black/50 p-4",
  modal: "w-full max-w-2xl rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl",
  modalMd: "my-auto w-full max-w-md shrink-0 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-2xl",
  modalTitle: "text-lg font-bold text-foreground",
  modalTitleSm: "text-base font-semibold text-foreground",
  modalBody: "mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground",
  modalCancel: "border-border bg-muted text-foreground hover:bg-muted/80",
  disputeSheet:
    "absolute inset-x-0 bottom-0 z-30 flex max-h-[min(85dvh,calc(100%-0.5rem))] flex-col rounded-t-2xl border border-border border-b-0 bg-card shadow-lg",
  fieldLabel: "text-xs font-medium text-foreground",
  select:
    "h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50",
  textarea:
    "min-h-[5rem] resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50",
  disputeInfo:
    "mt-2 max-w-full space-y-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-foreground",
  mediaLoading:
    "flex h-[200px] w-[200px] items-center justify-center rounded-lg border border-border bg-muted",
  attachmentPreview: "relative overflow-hidden rounded-lg border border-border bg-muted/40 p-2",
  attachmentInner: "flex min-h-[5rem] max-h-40 items-center justify-center overflow-hidden rounded-md bg-muted/60",
  attachmentRemoveBtn:
    "absolute right-1 top-1 z-10 h-8 w-8 rounded-full border border-border bg-background/90 text-foreground shadow-sm hover:border-primary hover:text-primary-readable",
  statusAmber:
    "max-w-full rounded-md border border-amber-500/30 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-950 dark:bg-amber-950/35 dark:text-amber-50/95",
  statusWarn: "text-xs text-amber-800 dark:text-amber-200/90",
  statusBanned: "text-xs text-amber-800 dark:text-amber-200",
  sellerCompleteBtn:
    "border-amber-600/50 bg-amber-50 text-amber-900 hover:border-amber-500 hover:bg-amber-100 dark:border-amber-600/60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/70",
  buyerDisputeBtn:
    "border-red-500/50 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-500/50 dark:bg-red-950/30 dark:text-red-100 dark:hover:bg-red-950/60",
  linkCardOther: "border-border bg-card",
  linkCardMine: "border-red-900/60 bg-red-950/40",
  linkField: "rounded-lg border border-border bg-muted/50 p-2.5",
  linkFieldLabel: "text-[11px] font-medium text-muted-foreground",
  linkFieldValue: "mt-0.5 break-all font-mono text-sm text-foreground",
  linkCopyBtnOther: "border-border bg-muted text-foreground hover:bg-muted/80",
  panel: "overflow-hidden rounded-2xl border border-border bg-card",
} as const
