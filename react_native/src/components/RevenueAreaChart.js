import Svg, { Circle, Defs, LinearGradient, Path, Stop, Line, Text as SvgText } from 'react-native-svg'
import { StyleSheet, View } from 'react-native'
import { ACCENT } from '../theme/colors'

/**
 * Lightweight area chart for revenue series: [{ shortLabel, revenue }]
 */
export default function RevenueAreaChart({
  series = [],
  height = 160,
  color = ACCENT,
  textColor = '#71717a',
  gridColor = '#e4e4e7',
}) {
  const width = 320
  const padL = 8
  const padR = 8
  const padT = 12
  const padB = 28
  const chartW = width - padL - padR
  const chartH = height - padT - padB

  const values = series.map((d) => Number(d.revenue) || 0)
  const max = Math.max(1, ...values)
  const n = series.length

  if (n === 0) {
    return <View style={[styles.empty, { height }]} />
  }

  const points = series.map((d, i) => {
    const x = padL + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW)
    const y = padT + chartH - (values[i] / max) * chartH
    return { x, y, label: d.shortLabel, value: values[i] }
  })

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ')

  const areaPath = `${linePath} L ${points[n - 1].x.toFixed(2)} ${(padT + chartH).toFixed(2)} L ${points[0].x.toFixed(2)} ${(padT + chartH).toFixed(2)} Z`

  const labelStep = n <= 7 ? 1 : n <= 14 ? 2 : Math.ceil(n / 6)

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>
        {[0, 0.5, 1].map((t) => {
          const y = padT + chartH * (1 - t)
          return (
            <Line
              key={t}
              x1={padL}
              y1={y}
              x2={padL + chartW}
              y2={y}
              stroke={gridColor}
              strokeDasharray="3 6"
              strokeWidth={1}
            />
          )
        })}
        <Path d={areaPath} fill="url(#revFill)" />
        <Path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={n <= 14 ? 2.5 : 1.5} fill={color} />
        ))}
        {points.map((p, i) => {
          if (i % labelStep !== 0 && i !== n - 1) return null
          return (
            <SvgText
              key={`l-${i}`}
              x={p.x}
              y={height - 8}
              fill={textColor}
              fontSize="9"
              textAnchor="middle"
            >
              {p.label}
            </SvgText>
          )
        })}
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'hidden',
  },
  empty: {
    width: '100%',
  },
})
