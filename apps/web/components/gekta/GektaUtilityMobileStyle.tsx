export function GektaUtilityMobileStyle() {
  return (
    <style>{`
      @media (max-width: 639px) {
        button,
        input:not([type='checkbox']):not([type='radio']):not([type='file']),
        textarea,
        select {
          -webkit-appearance: none;
          appearance: none;
        }
        button {
          font: inherit;
        }
        input:not([type='checkbox']):not([type='radio']):not([type='file']),
        textarea,
        select {
          min-height: 44px;
          font-size: 16px !important;
        }
        nav[aria-label='Gekta sections'] {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          overflow: visible !important;
        }
        nav[aria-label='Gekta sections'] > a {
          width: 100%;
          min-width: 0;
          justify-content: center;
          text-align: center;
          white-space: normal;
        }
      }
    `}</style>
  );
}
