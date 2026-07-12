'use client';

import { defaultColorPaletteLabels, type ColorPaletteLabels } from '../labels';
import styles from '../styles/colorPalette.module.css';

/**
 * 色板矩阵：10 个色相 × 6 个明度。
 * 第 1 行为纯色（最饱和），下方 5 行为同色相的明→暗变体。
 */
const PALETTE: string[][] = [
  ['#8b0000', '#ff0000', '#ff9100', '#ffeb00', '#00e000', '#00e5ff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff'],
  ['#dba0a0', '#e8b4c0', '#f5d9b8', '#f7f0c0', '#cfe8c4', '#bcd9d4', '#c4d4ec', '#cdd4e8', '#d6c4e0', '#e8c4dc'],
  ['#d28a8a', '#dd8c9c', '#eec49a', '#f0e29c', '#a9d4a0', '#94c0bc', '#a0bce4', '#a4b0d8', '#bca0d0', '#d49cc0'],
  ['#cc4444', '#d4506c', '#e89a5c', '#e8d05c', '#7cc06c', '#5ca09c', '#5c90e0', '#6478c8', '#9460c0', '#c45c98'],
  ['#a02020', '#b01030', '#c87410', '#c8a810', '#449030', '#2c706c', '#3060c0', '#1850a0', '#6428a0', '#a02868'],
  ['#5c1010', '#700818', '#7c4808', '#7c6808', '#205818', '#10403c', '#183c78', '#0c3060', '#3c1460', '#601838'],
];

// THEME 品牌色
const THEME_COLORS = ['#ff6719', '#ff5500'];

export interface ColorPaletteProps {
  /** 当前已应用的颜色（用于打勾），无则不选中。 */
  value?: string;
  /** 点击某色块。null 表示「None」（清除）。 */
  onPick: (color: string | null) => void;
  labels?: Partial<ColorPaletteLabels>;
}

/** 颜色面板：None 清除行 + 色板网格 + THEME 品牌色。 */
export function ColorPalette({ value, onPick, labels }: ColorPaletteProps) {
  const t = { ...defaultColorPaletteLabels, ...labels };
  const current = value?.toLowerCase();

  return (
    <div className={styles.palette}>
      <button
        type="button"
        className={styles.noneRow}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onPick(null)}
      >
        <span className={styles.noneIcon} aria-hidden />
        <span className={styles.noneLabel}>{t.none}</span>
      </button>

      <div className={styles.grid}>
        {PALETTE.flat().map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.swatch} ${
              current === c.toLowerCase() ? styles.swatchActive : ''
            }`}
            style={{ background: c }}
            title={c}
            aria-label={c}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(c)}
          />
        ))}
      </div>

      <div className={styles.themeLabel}>{t.theme}</div>
      <div className={styles.themeRow}>
        {THEME_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.swatch} ${
              current === c.toLowerCase() ? styles.swatchActive : ''
            }`}
            style={{ background: c }}
            title={c}
            aria-label={c}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(c)}
          />
        ))}
      </div>
    </div>
  );
}
