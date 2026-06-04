/**
 * Top-down full breadboard illustration for tray previews and canvas nodes.
 * @param width Render width in pixels.
 * @param height Render height in pixels.
 */
export function BreadboardArt({
  width,
  height,
}: {
  width: number
  height: number
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 420 140"
      preserveAspectRatio="none"
      aria-hidden
      className="block"
    >
      {/* Body */}
      <rect x="0" y="0" width="420" height="140" rx="6" fill="#e5e0d2" />
      <rect x="0" y="0" width="420" height="140" rx="6" fill="none" stroke="#c4baa8" strokeWidth="1.5" />

      {/* Top power rails */}
      <rect x="8" y="10" width="404" height="10" fill="rgba(210,38,38,0.22)" />
      <rect x="8" y="22" width="404" height="10" fill="rgba(38,68,210,0.22)" />

      {/* Bottom power rails */}
      <rect x="8" y="108" width="404" height="10" fill="rgba(210,38,38,0.22)" />
      <rect x="8" y="120" width="404" height="10" fill="rgba(38,68,210,0.22)" />

      {/* Centre channel */}
      <rect x="8" y="62" width="404" height="16" fill="#877e6c" opacity="0.55" />

      {/* Top body rows (a–e) */}
      {Array.from({ length: 5 }).map((_, row) => {
        const y = 36 + row * 5.2
        return Array.from({ length: 30 }).map((__, col) => (
          <circle key={`t-${row}-${col}`} cx={16 + col * 13.2} cy={y} r="1.6" fill="#1a1510" />
        ))
      })}

      {/* Bottom body rows (f–j) */}
      {Array.from({ length: 5 }).map((_, row) => {
        const y = 84 + row * 5.2
        return Array.from({ length: 30 }).map((__, col) => (
          <circle key={`b-${row}-${col}`} cx={16 + col * 13.2} cy={y} r="1.6" fill="#1a1510" />
        ))
      })}

      {/* Column ticks every 5 */}
      {Array.from({ length: 6 }).map((_, i) => {
        const x = 16 + i * 66
        return (
          <g key={`tick-${i}`}>
            <line x1={x} y1="4" x2={x} y2="8" stroke="#8a7d68" strokeWidth="1" />
            <line x1={x} y1="132" x2={x} y2="136" stroke="#8a7d68" strokeWidth="1" />
          </g>
        )
      })}
    </svg>
  )
}
