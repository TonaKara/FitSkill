/**
 * ヘッダー用のシンボルマーク（scripts/brand-assets/logo-mark.svg と同一パス）。
 * アプリアイコン等で使う「赤角丸タイル＋このマーク」が正式なブランドロゴ（ロックアップ）。
 * `fill="currentColor"` のため、祖先の `text-*` / `color` で色を決める。
 */
export function BrandMarkSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="140 154 720 720" aria-hidden={true} className={className}>
      <g
        fill="currentColor"
        transform="translate(0 24) translate(500 513.875) scale(1.07) translate(-500 -513.875)"
      >
        <polygon points="766.38 256.39 705.86 359.43 738.47 359.43 798.73 256.39 766.38 256.39" />
        <polygon points="688.38 359.43 749.95 256.39 717.34 256.39 656.03 359.43 688.38 359.43" />
        <polygon points="638.55 359.43 699.34 256.39 666.21 256.39 604.64 359.43 638.55 359.43" />
        <path d="M441.73,465.15h147.91l-89.61,156.33-165.91-284.28h174.13l-12.91,22.24h89.02l61.24-103.04c.2,0-444.33,0-444.33,0l305.41,514.96,221.48-388.37h-334.37l47.93,82.17Z" />
      </g>
    </svg>
  )
}
