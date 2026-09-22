import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'

/** 1×1 white PNG — use when the pad is cleared or empty */
export const SIGNATURE_EMPTY_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='

const SVG_PREFIX = 'svg-signature:'

export function isSignatureSigned(value) {
  return (
    typeof value === 'string' &&
    value.startsWith(SVG_PREFIX) &&
    value.length > SVG_PREFIX.length
  )
}

/** Serialize stroke point arrays to a compact string (strokes joined by `|`). */
export function serializeSignatureStrokes(strokes) {
  if (!strokes?.length) return ''
  return strokes
    .filter((stroke) => stroke.length > 1)
    .map((stroke) =>
      stroke.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
    )
    .join('|')
}

function strokeToPathD(stroke) {
  if (!stroke?.length) return ''
  const [first, ...rest] = stroke
  if (!rest.length) {
    return `M ${first.x} ${first.y} L ${first.x + 0.01} ${first.y + 0.01}`
  }
  return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(' ')}`
}

export default function SignaturePad({
  onChange,
  height = 160,
  strokeColor = '#111',
  strokeWidth = 2.5,
}) {
  const [strokes, setStrokes] = useState([])
  const [layoutWidth, setLayoutWidth] = useState(0)
  const strokesRef = useRef([])
  const activeStrokeRef = useRef([])

  const emitChange = useCallback(
    (nextStrokes) => {
      const joined = serializeSignatureStrokes(nextStrokes)
      if (!joined) {
        onChange?.(SIGNATURE_EMPTY_DATA_URL)
      } else {
        onChange?.(`${SVG_PREFIX}${joined}`)
      }
    },
    [onChange],
  )

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent
          activeStrokeRef.current = [{ x: locationX, y: locationY }]
          setStrokes((prev) => {
            const next = [...prev, [...activeStrokeRef.current]]
            strokesRef.current = next
            return next
          })
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent
          activeStrokeRef.current.push({ x: locationX, y: locationY })
          setStrokes((prev) => {
            const next = [...prev.slice(0, -1), [...activeStrokeRef.current]]
            strokesRef.current = next
            return next
          })
        },
        onPanResponderRelease: () => {
          emitChange(strokesRef.current)
          activeStrokeRef.current = []
        },
        onPanResponderTerminate: () => {
          emitChange(strokesRef.current)
          activeStrokeRef.current = []
        },
      }),
    [emitChange],
  )

  const handleClear = useCallback(() => {
    strokesRef.current = []
    activeStrokeRef.current = []
    setStrokes([])
    onChange?.(SIGNATURE_EMPTY_DATA_URL)
  }, [onChange])

  return (
    <View style={styles.root}>
      <View
        style={[styles.pad, { height }]}
        onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        {layoutWidth > 0 ? (
          <Svg width={layoutWidth} height={height} style={StyleSheet.absoluteFill}>
            {strokes.map((stroke, index) => (
              <Path
                key={`stroke-${index}`}
                d={strokeToPathD(stroke)}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>
        ) : null}
        {!strokes.length ? (
          <Text style={styles.hint} pointerEvents="none">
            Sign here
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={handleClear}
        style={styles.clearBtn}
        activeOpacity={0.7}
      >
        <Text style={styles.clearText}>Clear</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  pad: {
    width: '100%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  hint: {
    position: 'absolute',
    left: 12,
    top: 12,
    fontSize: 14,
    color: '#9ca3af',
  },
  clearBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
})
