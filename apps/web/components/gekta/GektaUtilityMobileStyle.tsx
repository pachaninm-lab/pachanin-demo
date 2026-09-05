export function GektaUtilityMobileStyle() {
  return (
    <style>{`
      [data-gekta-utility-page] {
        -webkit-text-size-adjust: none;
        text-size-adjust: none;
      }

      @media (max-width: 639px) {
        [data-gekta-utility-page] button,
        [data-gekta-utility-page] input:not([type='checkbox']):not([type='radio']):not([type='file']),
        [data-gekta-utility-page] textarea {
          -webkit-appearance: none;
          appearance: none;
        }
        [data-gekta-utility-page] button {
          font-family: inherit;
        }
        [data-gekta-utility-page] button:not([type='submit']) {
          background-clip: padding-box;
        }
        [data-gekta-utility-page] input:not([type='checkbox']):not([type='radio']):not([type='file']),
        [data-gekta-utility-page] textarea,
        [data-gekta-utility-page] select {
          min-height: 44px;
          font-size: 16px !important;
          font-family: inherit;
        }
        [data-gekta-utility-page] nav[aria-label='Gekta sections'] {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          overflow: visible !important;
        }
        [data-gekta-utility-page] nav[aria-label='Gekta sections'] > a {
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
