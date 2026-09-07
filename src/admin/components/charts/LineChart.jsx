import { useState, useId } from 'react'
import ChartTooltip from './ChartTooltip'

// ── Chart geometry ────────────────────────────────────────────────────────────
// All values are in the SVG's own coordinate system (the viewBox).
// Generous, intentional padding ensures every element — labels, circles,
// stroke half-widths — stays fully inside the viewBox with no clipping.
const W   = 620          // viewBox width
const H   = 260          // viewBox height
const PAD = {
  top:    24,   // room above the top grid line (stroke overshoot)
  right:  24,   // room right of the last data point (circle r=6 + stroke=2.5 ≈ 8)
  bottom: 38,   // room for X-axis labels (font ~11px + 8px gap = 27px from baseline)
  left:   56,   // room for Y-axis labels (up to "9.9k" wide + 8px gap)
}
const IW  = W - PAD.left - PAD.right    // inner plot width  = 540
const IH  = H - PAD.top  - PAD.bottom   // inner plot height = 198

const GRID_LINES  = 4
const BASE_R      = 4     // normal data-point circle radius
const ACTIVE_R    = 6     // hovered data-point circle radius
const TENSION     = 0.32  // catmull-rom tension (lower = less overshoot)

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map data values → SVG {x,y} coordinates, clamping y within the plot area. */
function buildPoints(values, max) {
  const step = IW / Math.max(values.length - 1, 1)
  return values.map((v, i) => ({
    x: PAD.left + i * step,
    // Clamp so no point lands outside [PAD.top, PAD.top+IH], even if max ≈ v
    y: PAD.top + IH - Math.min(Math.max(v / max, 0), 1) * IH,
  }))
}

/**
 * Smooth cubic bezier through points (catmull-rom → cubic bezier conversion).
 * Control-point Y values are clamped to the inner plot area so that
 * even aggressive curves never leave the visible region.
 */
function toSmoothPath(pts) {
  if (pts.length < 2) return ''
  const clampY = (y) => Math.min(Math.max(y, PAD.top), PAD.top + IH)
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
  for (let i = 1; i < pts.length; i++) {
    const prev  = pts[i - 1]
    const curr  = pts[i]
    const pprev = pts[i - 2] ?? prev
    const next  = pts[i + 1] ?? curr
    const cp1x = prev.x + (curr.x  - pprev.x) * TENSION
    const cp1y = clampY(prev.y + (curr.y  - pprev.y) * TENSION)
    const cp2x = curr.x - (next.x  - prev.x)  * TENSION
    const cp2y = clampY(curr.y - (next.y  - prev.y)  * TENSION)
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)},${cp2x.toFixed(2)} ${cp2y.toFixed(2)},${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`
  }
  return d
}

/** Closed area-fill path (line + drop to baseline + close). */
function toAreaPath(pts) {
  if (pts.length < 2) return ''
  const base = (PAD.top + IH).toFixed(2)
  return `${toSmoothPath(pts)} L ${pts.at(-1).x.toFixed(2)} ${base} L ${pts[0].x.toFixed(2)} ${base} Z`
}

/** Compact number formatter: 1500 → "1.5k", 200 → "200". */
function fmtY(v) {
  if (v >= 1000) return `${+(v / 1000).toFixed(1)}k`
  return String(Math.round(v))
}

function changeInfo(cur, prev, prevLabel) {
  if (prev === undefined || prevLabel === undefined) return { change: null, dir: 'flat' }
  if (prev === 0) {
    return cur > 0
      ? { change: `New activity vs ${prevLabel}`, dir: 'up' }
      : { change: `No change vs ${prevLabel}`, dir: 'flat' }
  }
  const pct = ((cur - prev) / prev) * 100
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'
  return {
    change: `${pct > 0 ? '+' : ''}${(Math.abs(pct) < 0.05 ? 0 : pct).toFixed(1)}% vs ${prevLabel}`,
    dir,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LineChart({ title, labels, series }) {
  const uid     = useId()
  const [tip, setTip]     = useState(null)
  const [crossX, setCrossX] = useState(null)

  const max    = Math.max(...series.flatMap((s) => s.values), 1)
  const baseY  = PAD.top + IH        // y-coordinate of the x-axis baseline

  const clearTip = () => { setTip(null); setCrossX(null) }

  // Unique IDs for SVG defs (avoids id collisions when chart appears multiple times)
  const clipId  = `${uid}-clip`
  const ptsClip = `${uid}-pts`

  // X-axis label density: skip labels when too many to fit without overlap
  // Minimum ~55 px per label at the current IW
  const labelEvery = Math.max(1, Math.ceil(labels.length / Math.floor(IW / 55)))

  return (
    <div className="admin-chart">
      {title && <h3 className="admin-chart__title">{title}</h3>}

      {/* Plot area */}
      <div className="admin-chart__plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="admin-chart__svg"
          role="img"
          aria-label={title}
        >
          <defs>
            {/*
              Clip path for lines and area fills.
              Exactly matches the inner plot rectangle so curves can never
              paint outside the chart borders.
            */}
            <clipPath id={clipId}>
              <rect x={PAD.left} y={PAD.top} width={IW} height={IH} />
            </clipPath>

            {/*
              Slightly expanded clip for data-point circles:
              adds ACTIVE_R buffer on every side so an edge circle at
              x=PAD.left or x=PAD.left+IW is fully visible.
            */}
            <clipPath id={ptsClip}>
              <rect
                x={PAD.left  - ACTIVE_R}
                y={PAD.top   - ACTIVE_R}
                width={IW    + ACTIVE_R * 2}
                height={IH   + ACTIVE_R * 2}
              />
            </clipPath>

            {/* Gradient fills, one per series */}
            {series.map((s) => (
              <linearGradient
                key={s.key}
                id={`${uid}-grad-${s.key}`}
                x1="0" y1="0" x2="0" y2="1"
              >
                <stop offset="0%"   stopColor={s.color} stopOpacity="0.16" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0"    />
              </linearGradient>
            ))}
          </defs>

          {/* ── Grid lines + Y-axis labels ──────────────────────────────── */}
          {Array.from({ length: GRID_LINES + 1 }, (_, i) => {
            const y   = PAD.top + (IH / GRID_LINES) * i
            const val = max * (1 - i / GRID_LINES)
            return (
              <g key={i}>
                <line
                  x1={PAD.left}      y1={y}
                  x2={PAD.left + IW} y2={y}
                  className="admin-chart__grid"
                />
                {/* Y label: anchored to the right, gap of 8px from the plot edge */}
                <text
                  x={PAD.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  dominantBaseline="auto"
                  className="admin-chart__axis-label admin-chart__y-label"
                >
                  {fmtY(val)}
                </text>
              </g>
            )
          })}

          {/* ── Vertical crosshair (clipped to inner area) ─────────────── */}
          {crossX !== null && (
            <line
              x1={crossX} y1={PAD.top}
              x2={crossX} y2={baseY}
              className="admin-chart__crosshair"
              clipPath={`url(#${clipId})`}
            />
          )}

          {/* ── Area fills — BEHIND lines, clipped ─────────────────────── */}
          {series.map((s) => (
            <path
              key={`area-${s.key}`}
              d={toAreaPath(buildPoints(s.values, max))}
              fill={`url(#${uid}-grad-${s.key})`}
              clipPath={`url(#${clipId})`}
              className="admin-chart__area"
            />
          ))}

          {/* ── Lines — clipped ─────────────────────────────────────────── */}
          {series.map((s) => (
            <path
              key={`line-${s.key}`}
              d={toSmoothPath(buildPoints(s.values, max))}
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="admin-chart__line"
              pathLength="1"
              clipPath={`url(#${clipId})`}
            />
          ))}

          {/* ── Data-point circles — expanded clip ─────────────────────── */}
          {series.map((s) => {
            const pts = buildPoints(s.values, max)
            return (
              <g key={`pts-${s.key}`} clipPath={`url(#${ptsClip})`}>
                {pts.map((p, i) => {
                  const active = tip?.seriesKey === s.key && tip?.index === i
                  const info   = changeInfo(s.values[i], s.values[i - 1], labels[i - 1])
                  return (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={active ? ACTIVE_R : BASE_R}
                      fill="#fff"
                      stroke={s.color}
                      strokeWidth={active ? 2.5 : 2}
                      className="admin-chart__point"
                      style={{ animationDelay: `${0.35 + i * 0.05}s` }}
                      onMouseEnter={() => {
                        setCrossX(p.x)
                        setTip({
                          seriesKey: s.key,
                          index:     i,
                          left:  `${(p.x / W) * 100}%`,
                          top:   `${(p.y / H) * 100}%`,
                          label: `${s.label} · ${labels[i]}`,
                          value: s.values[i].toLocaleString(),
                          change: info.change,
                          dir:    info.dir,
                        })
                      }}
                      onMouseLeave={clearTip}
                    />
                  )
                })}
              </g>
            )
          })}

          {/* ── X-axis labels ────────────────────────────────────────────── */}
          {labels.map((label, i) => {
            // Skip dense labels (keep first, last, and every nth)
            const isFirst = i === 0
            const isLast  = i === labels.length - 1
            if (!isFirst && !isLast && i % labelEvery !== 0) return null

            const rawX = PAD.left + (IW / Math.max(labels.length - 1, 1)) * i
            // First label: left-anchor so it doesn't overflow the left edge
            // Last label: right-anchor so it doesn't overflow the right edge
            // Others: centered on the data point
            const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle'
            return (
              <text
                key={label}
                x={rawX}
                y={H - 8}
                textAnchor={anchor}
                dominantBaseline="auto"
                className="admin-chart__axis-label"
              >
                {label}
              </text>
            )
          })}
        </svg>
        <ChartTooltip tip={tip} />
      </div>

      {/* Legend — rendered below the X-axis labels */}
      <div className="admin-chart__legend">
        {series.map((s) => (
          <span key={s.key} className="admin-chart__legend-item">
            <span className="admin-chart__legend-dot" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
