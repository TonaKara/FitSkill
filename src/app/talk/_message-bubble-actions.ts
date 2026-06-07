/**
 * タッチ端末では常時表示。PC はホバー時のみ表示。
 * ボタンは吹き出し横の flex 列に置き、absolute にしない（ホバー移動で消えないようにする）。
 */
export const messageActionButtonClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-md transition-opacity opacity-100 hover:text-black focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black md:h-6 md:w-6 md:opacity-0 md:shadow-sm md:pointer-events-none md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100"
