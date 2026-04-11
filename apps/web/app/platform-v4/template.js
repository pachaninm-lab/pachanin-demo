import { createElement } from 'react';
import './command-layer.css';
import { PlatformV4CommandLayer } from './platform-v4-command-layer';

export default function Template({ children }) {
  return createElement(
    'div',
    { className: 'pc-v4-template-shell' },
    createElement(PlatformV4CommandLayer),
    createElement('div', { className: 'pc-v4-template-content' }, children),
  );
}
