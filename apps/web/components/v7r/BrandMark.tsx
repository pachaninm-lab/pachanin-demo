import type { CSSProperties } from 'react';

interface BrandMarkSvgProps {
  size?: number | string;
}

interface BrandMarkProps extends BrandMarkSvgProps {
  rounded?: number;
  shadow?: boolean;
  style?: CSSProperties;
}

function normalizeSize(size: number | string) {
  return typeof size === 'number' ? `${size}px` : size;
}

const BRAND_LOGO_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAADHlklEQVR42uz9edxlWVUejj9r7X3Ovfcdaq6uanqm6WZsBgExODQQGYKSEE3jjH41jnFISCEhE0w7IGZBTEBASAhEwACBHwCGY0TggCen++t+NbZq6r5333Ovqpq6q3p+7O/PK9dnhUyVmJmZfa3zlbnX3uv5vHxrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKy...'}