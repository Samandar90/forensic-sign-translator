import { HandLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'

/** Layout for mapping MediaPipe normalized coords → overlay CSS pixels (matches `<video object-fit: cover>` + optional mirror). */
export interface HandOverlayLayout {
  readonly displayCssW: number
  readonly displayCssH: number
  readonly intrinsicW: number
  readonly intrinsicH: number
  /** When true, flip X so overlay matches a CSS `transform: scaleX(-1)` preview. */
  readonly mirrorX: boolean
  readonly dpr: number
}

export interface HandDrawStyle {
  readonly connectorRgba: string
  readonly connectorWidthCss: number
  readonly pointRgba: string
  readonly pointRadiusCss: number
  readonly labelRgba: string
  readonly labelFontCss: string
  /** Optional inner fill for premium two-layer dots. */
  readonly pointCoreRgba?: string
  /** Optional outer ring for dots (defaults to semi-transparent white). */
  readonly pointRingRgba?: string
}

const STYLE_LEFT: HandDrawStyle = {
  connectorRgba: 'rgba(96, 165, 250, 0.38)',
  connectorWidthCss: 1.05,
  pointRgba: 'rgba(255, 255, 255, 0.55)',
  pointRingRgba: 'rgba(255, 255, 255, 0.45)',
  pointCoreRgba: 'rgba(59, 130, 246, 0.92)',
  pointRadiusCss: 2.05,
  labelRgba: 'rgba(248, 250, 252, 0.92)',
  labelFontCss: '600 10px system-ui, Inter, sans-serif',
}

const STYLE_RIGHT: HandDrawStyle = {
  connectorRgba: 'rgba(129, 140, 248, 0.38)',
  connectorWidthCss: 1.05,
  pointRgba: 'rgba(255, 255, 255, 0.55)',
  pointRingRgba: 'rgba(255, 255, 255, 0.45)',
  pointCoreRgba: 'rgba(99, 102, 241, 0.92)',
  pointRadiusCss: 2.05,
  labelRgba: 'rgba(248, 250, 252, 0.92)',
  labelFontCss: '600 10px system-ui, Inter, sans-serif',
}

const STYLE_UNKNOWN: HandDrawStyle = {
  connectorRgba: 'rgba(148, 163, 184, 0.36)',
  connectorWidthCss: 1,
  pointRgba: 'rgba(255, 255, 255, 0.5)',
  pointRingRgba: 'rgba(255, 255, 255, 0.35)',
  pointCoreRgba: 'rgba(148, 163, 184, 0.88)',
  pointRadiusCss: 1.85,
  labelRgba: 'rgba(248, 250, 252, 0.78)',
  labelFontCss: '600 10px system-ui, Inter, sans-serif',
}

const TIP_INDICES = [4, 8, 12, 16, 20] as const
const TIP_LABELS = ['T', 'I', 'M', 'R', 'P'] as const

export function readHandOverlayLayout(
  video: HTMLVideoElement,
  opts: { mirrorX: boolean },
): HandOverlayLayout | null {
  const iw = video.videoWidth
  const ih = video.videoHeight
  if (iw <= 0 || ih <= 0) return null

  const displayCssW = Math.max(1, Math.floor(video.clientWidth))
  const displayCssH = Math.max(1, Math.floor(video.clientHeight))
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)

  return {
    displayCssW,
    displayCssH,
    intrinsicW: iw,
    intrinsicH: ih,
    mirrorX: opts.mirrorX,
    dpr,
  }
}

export function normalizedToOverlayCss(
  nx: number,
  ny: number,
  layout: HandOverlayLayout,
): { x: number; y: number } {
  const { displayCssW: W, displayCssH: H, intrinsicW: iw, intrinsicH: ih, mirrorX } = layout

  const s = Math.max(W / iw, H / ih)
  const visW = W / s
  const visH = H / s
  const ox = (iw - visW) * 0.5
  const oy = (ih - visH) * 0.5

  let x = (nx * iw - ox) * s
  const y = (ny * ih - oy) * s

  if (mirrorX) x = W - x
  return { x, y }
}

export function syncOverlayCanvasToLayout(canvas: HTMLCanvasElement, layout: HandOverlayLayout): void {
  const bw = Math.max(1, Math.floor(layout.displayCssW * layout.dpr))
  const bh = Math.max(1, Math.floor(layout.displayCssH * layout.dpr))
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw
    canvas.height = bh
  }
  canvas.style.width = `${layout.displayCssW}px`
  canvas.style.height = `${layout.displayCssH}px`
}

export function clearHandOverlay(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

export function drawConnections(
  ctx: CanvasRenderingContext2D,
  hand: readonly NormalizedLandmark[],
  layout: HandOverlayLayout,
  style: HandDrawStyle,
  connections: readonly { start: number; end: number }[],
): void {
  ctx.save()
  ctx.strokeStyle = style.connectorRgba
  ctx.lineWidth = style.connectorWidthCss
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalAlpha = 0.95

  for (const { start, end } of connections) {
    const a = hand[start]
    const b = hand[end]
    if (!a || !b) continue
    const pa = normalizedToOverlayCss(a.x, a.y, layout)
    const pb = normalizedToOverlayCss(b.x, b.y, layout)
    ctx.beginPath()
    ctx.moveTo(pa.x, pa.y)
    ctx.lineTo(pb.x, pb.y)
    ctx.stroke()
  }

  ctx.globalAlpha = 1
  ctx.restore()
}

export function drawLandmarks(
  ctx: CanvasRenderingContext2D,
  hand: readonly NormalizedLandmark[],
  layout: HandOverlayLayout,
  style: HandDrawStyle,
): void {
  const ring = style.pointRingRgba ?? 'rgba(255,255,255,0.4)'
  const core = style.pointCoreRgba ?? style.pointRgba
  const r = style.pointRadiusCss

  ctx.save()
  for (const lm of hand) {
    const p = normalizedToOverlayCss(lm.x, lm.y, layout)
    ctx.beginPath()
    ctx.arc(p.x, p.y, r + 0.85, 0, Math.PI * 2)
    ctx.fillStyle = ring
    ctx.fill()

    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fillStyle = core
    ctx.fill()

    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.strokeStyle = style.connectorRgba
    ctx.lineWidth = 0.65
    ctx.stroke()
  }
  ctx.restore()
}

export function drawFingerLabels(
  ctx: CanvasRenderingContext2D,
  hand: readonly NormalizedLandmark[],
  layout: HandOverlayLayout,
  style: HandDrawStyle,
): void {
  ctx.font = style.labelFontCss
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = style.labelRgba

  for (let i = 0; i < TIP_INDICES.length; i += 1) {
    const idx = TIP_INDICES[i]
    const lm = hand[idx]
    if (!lm) continue
    const p = normalizedToOverlayCss(lm.x, lm.y, layout)
    ctx.fillText(TIP_LABELS[i], p.x, p.y - 10)
  }
}

export interface HandOverlayEntry {
  readonly landmarks: readonly NormalizedLandmark[]
  readonly displaySide: 'Left' | 'Right' | 'Unknown'
  readonly label: string
}

export interface RenderHandsOptions {
  readonly style?: Partial<HandDrawStyle>
  readonly showFingerLabels?: boolean
  /** Softer skeleton, smaller joints, no wrist labels — minimal UI over video. */
  readonly minimal?: boolean
}

const OFFICIAL_CONNECTIONS = HandLandmarker.HAND_CONNECTIONS

function styleMinimalVariant(base: HandDrawStyle): HandDrawStyle {
  return {
    ...base,
    connectorWidthCss: Math.max(0.72, base.connectorWidthCss * 0.85),
    pointRadiusCss: Math.max(1.4, base.pointRadiusCss * 0.85),
  }
}

function styleForSide(side: HandOverlayEntry['displaySide']): HandDrawStyle {
  if (side === 'Left') return STYLE_LEFT
  if (side === 'Right') return STYLE_RIGHT
  return STYLE_UNKNOWN
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function drawWristLabelPill(
  ctx: CanvasRenderingContext2D,
  hand: readonly NormalizedLandmark[],
  layout: HandOverlayLayout,
  text: string,
): void {
  const wrist = hand[0]
  if (!wrist || !text) return
  const p = normalizedToOverlayCss(wrist.x, wrist.y, layout)
  ctx.save()
  ctx.font = '600 10px Inter, system-ui, sans-serif'
  const padX = 8
  const h = 20
  const w = Math.ceil(ctx.measureText(text).width) + padX * 2
  const x = p.x - w * 0.5
  const y = p.y - 26 - h

  roundRectPath(ctx, x, y, w, h, 8)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.38)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, p.x, y + h * 0.5)
  ctx.restore()
}

/** Draw all tracked hands with side-specific colors and wrist labels. */
export function renderHandLandmarksOverlay(
  ctx: CanvasRenderingContext2D,
  layout: HandOverlayLayout,
  hands: readonly HandOverlayEntry[],
  options: RenderHandsOptions = {},
): void {
  const { dpr } = layout

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.imageSmoothingEnabled = true
  const hq = ctx as CanvasRenderingContext2D & { imageSmoothingQuality?: string }
  hq.imageSmoothingQuality = 'high'
  ctx.scale(dpr, dpr)

  const minimal = options.minimal ?? false

  for (const entry of hands) {
    const hand = entry.landmarks
    if (!hand?.length) continue
    const base = styleForSide(entry.displaySide)
    const merged: HandDrawStyle = { ...base, ...options.style }
    const style: HandDrawStyle = minimal ? styleMinimalVariant(merged) : merged

    ctx.save()
    if (minimal) {
      ctx.globalAlpha = 0.52
    }
    drawConnections(ctx, hand, layout, style, OFFICIAL_CONNECTIONS)
    drawLandmarks(ctx, hand, layout, style)
    ctx.restore()

    if (options.showFingerLabels && !minimal) {
      drawFingerLabels(ctx, hand, layout, style)
    }
    if (!minimal) {
      drawWristLabelPill(ctx, hand, layout, entry.label)
    }
  }

  ctx.restore()
}
