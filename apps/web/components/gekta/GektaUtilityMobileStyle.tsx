export function GektaUtilityMobileStyle() {
  return (
    <style>{`
      @media (max-width: 639px) {
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
