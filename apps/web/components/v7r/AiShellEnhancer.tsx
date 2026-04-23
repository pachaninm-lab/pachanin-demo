'use client';

export function AiShellEnhancer() {
  return (
    <style>{`
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
