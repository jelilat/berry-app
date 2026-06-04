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
  const columns = Array.from({ length: 12 }, (_, i) => (i + 1) * 5)
  const topRows = ['a', 'b', 'c', 'd', 'e']
  const bottomRows = ['f', 'g', 'h', 'i', 'j']

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

      {columns.map((col) => {
        const x = 16 + (col - 1) * 6.6
        return (
          <g key={`col-label-${col}`} fill="#8a7d68" fontSize="4.8" fontWeight="700" textAnchor="middle">
            <text x={x} y="8">{col}</text>
            <text x={x} y="137">{col}</text>
          </g>
        )
      })}

      {/* Top power rails */}
      <rect x="8" y="10" width="404" height="10" fill="rgba(210,38,38,0.22)" />
      <rect x="8" y="22" width="404" height="10" fill="rgba(38,68,210,0.22)" />

      {/* Bottom power rails */}
      <rect x="8" y="108" width="404" height="10" fill="rgba(210,38,38,0.22)" />
      <rect x="8" y="120" width="404" height="10" fill="rgba(38,68,210,0.22)" />

      {/* Centre channel */}
      <rect x="8" y="62" width="404" height="16" fill="#877e6c" opacity="0.55" />

      {/* Top body rows (a-e) */}
      {Array.from({ length: 5 }).map((_, row) => {
        const y = 36 + row * 5.2
        return (
          <g key={`top-row-${row}`}>
            <text x="6" y={y + 1.6} fill="#8a7d68" fontSize="5" fontWeight="700" textAnchor="middle">
              {topRows[row]}
            </text>
            <text x="414" y={y + 1.6} fill="#8a7d68" fontSize="5" fontWeight="700" textAnchor="middle">
              {topRows[row]}
            </text>
            {Array.from({ length: 60 }).map((__, col) => (
              <circle key={`t-${row}-${col}`} cx={16 + col * 6.6} cy={y} r="1.35" fill="#1a1510" />
            ))}
          </g>
        )
      })}

      {/* Bottom body rows (f-j) */}
      {Array.from({ length: 5 }).map((_, row) => {
        const y = 84 + row * 5.2
        return (
          <g key={`bottom-row-${row}`}>
            <text x="6" y={y + 1.6} fill="#8a7d68" fontSize="5" fontWeight="700" textAnchor="middle">
              {bottomRows[row]}
            </text>
            <text x="414" y={y + 1.6} fill="#8a7d68" fontSize="5" fontWeight="700" textAnchor="middle">
              {bottomRows[row]}
            </text>
            {Array.from({ length: 60 }).map((__, col) => (
              <circle key={`b-${row}-${col}`} cx={16 + col * 6.6} cy={y} r="1.35" fill="#1a1510" />
            ))}
          </g>
        )
      })}

      {/* Column ticks every 5 */}
      {Array.from({ length: 12 }).map((_, i) => {
        const x = 16 + i * 33
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
