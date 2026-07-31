import type { ReactNode } from 'react';

const COMPARISON_MARKER_ALIGNMENT_CSS = `
.pc-v7-public-entry [data-comparison-row='true'] > span:first-of-type::before {
  content: '' !important;
  box-sizing: border-box;
  width: 22px !important;
  height: 22px !important;
  margin-top: 0 !important;
  border: 2px solid #d92d2d !important;
  border-radius: 50% !important;
  background:
    linear-gradient(45deg, transparent calc(50% - 1.25px), #d92d2d calc(50% - 1.25px), #d92d2d calc(50% + 1.25px), transparent calc(50% + 1.25px)),
    linear-gradient(-45deg, transparent calc(50% - 1.25px), #d92d2d calc(50% - 1.25px), #d92d2d calc(50% + 1.25px), transparent calc(50% + 1.25px)) !important;
  background-size: 12px 12px !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
}

@media (max-width: 767px) {
  .pc-v7-public-entry [data-comparison-row='true'] > span:first-of-type::before {
    width: 20px !important;
    height: 20px !important;
    background-size: 11px 11px !important;
  }
}
`;

/**
 * Platform V7 pages own their rendering contract through the public shell,
 * the server-verified protected shell and Design System v8 route components.
 * Historical DOM mutation, copy repair and viewport polling are intentionally absent.
 */
export default function PlatformV7Template({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{COMPARISON_MARKER_ALIGNMENT_CSS}</style>
      {children}
    </>
  );
}
