export type NormalizedPoint = [number, number];

export interface QiVerseWorkModel {
  schemaVersion: string;
  source?: string;
  work: QiVerseWorkInfo;
  renderHints?: QiVerseRenderHints;
  glyphs: QiVerseGlyph[];
  qiLinks: QiLink[];
  voidRegions: VoidRegion[];
}

export interface QiVerseWorkInfo {
  id: string;
  sourceWorkId: string;
  title: string;
  heightImage: string;
  description?: string;
  boundary?: string[];
}

export interface QiVerseRenderHints {
  enterGlyphId?: string;
  baseStrokeRadius?: number;
  baseStrokeOpacity?: number;
  strokeColor?: string;
}

export interface QiVerseGlyph {
  id: string;
  character: string;
  label?: string;
  image: string;
  bounds: PixelBounds;
  coordinate: "normalized within bounds, origin top-left" | string;
  strokes: Stroke[];
}

export interface PixelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Stroke {
  id: string;
  label: string;
  path: NormalizedPoint[];
  width: number | number[];
  inkDensity: number | number[];
  curvature: number;
  speedProxy?: number;
  flyingWhite?: number;
  turningPoints?: number[];
  pausePoints?: number[];
}

export interface QiLink {
  id: string;
  label?: string;
  fromStrokeId?: string;
  toStrokeId?: string;
  path: NormalizedPoint[];
  intensity?: number;
  rhythm?: number;
}

export interface VoidRegion {
  id: string;
  type?: "intraCharacter" | "interCharacter" | "interLine" | "flyingWhite" | string;
  label?: string;
  polygon: NormalizedPoint[];
  depth?: number;
  breath?: number;
}
