'use client';

export function AiShellEnhancer() {
  return (
    <style>{`
      .pc-header-brand > span:first-child,
      .app-header-brand > span:first-child,
      .pc-brand-mark-fallback {
        background-image: none !important;
      }

      .pc-header-brand > span:first-child img,
      .app-header-brand > span:first-child img,
      .pc-brand-mark-fallback img,
      img[src='/apple-icon'],
      img[src^='/apple-icon?'] {
        opacity: 1 !important;
        visibility: visible !important;
        display: block !important;
      }

      .pc-giga,
      [data-pc-ai-panel='legacy'],
      #pc-ai-dock,
      .sticky-action,
      .pc-main .pc-giga,
      .pc-main [class*='giga'],
      .pc-main [class*='sticky-action'] {
        display: none !important;
      }
    `}</style>
  );
}
