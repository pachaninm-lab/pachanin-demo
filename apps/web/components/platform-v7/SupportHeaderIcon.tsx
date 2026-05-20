'use client';

export function SupportHeaderIcon() {
  return (
    <style>{`
      @media(max-width:767px){
        .pc-v4-search{display:none!important}
        .pc-v4-actions{gap:6px!important}
        .pc-v4-actions > div,
        .pc-v4-actions > a{flex:0 0 auto!important}
        .pc-v4-actions button[aria-label='Уведомления']{display:inline-flex!important}
        .pc-v4-actions > div:has(button[aria-label='Идентификация и настройки']){display:inline-flex!important;flex:0 0 auto!important}
        .pc-v4-actions button[aria-label='Идентификация и настройки']{width:42px!important;min-width:42px!important;max-width:42px!important;height:42px!important;min-height:42px!important;padding:4px!important;border-radius:13px!important;overflow:hidden!important;justify-content:center!important}
        .pc-v4-actions button[aria-label='Идентификация и настройки'] > span:nth-child(2),
        .pc-v4-actions button[aria-label='Идентификация и настройки'] > svg{display:none!important}
        .pc-v4-actions button[aria-label='Идентификация и настройки'] > span:first-child{width:28px!important;height:28px!important;font-size:9px!important}
        .pc-v4-drawer{width:min(344px,84vw)!important;max-width:84vw!important;border-top-right-radius:24px!important;border-bottom-right-radius:24px!important;overflow:hidden!important}

        main[data-testid='platform-v7-control-tower-page']{gap:12px!important}
        main[data-testid='platform-v7-control-tower-page'] > header{display:none!important}
        main[data-testid='platform-v7-control-tower-page'] > section:not(.ct-priority){display:none!important}
        main[data-testid='platform-v7-control-tower-page'] .ct-priority{padding:16px!important;border-radius:24px!important;gap:12px!important}
        main[data-testid='platform-v7-control-tower-page'] .ct-priority-main{grid-template-columns:1fr!important;gap:12px!important}
        main[data-testid='platform-v7-control-tower-page'] .ct-priority-main > div:nth-child(2){display:none!important}
        main[data-testid='platform-v7-control-tower-page'] .ct-priority h2{font-size:clamp(30px,8vw,42px)!important;line-height:1.04!important}
        main[data-testid='platform-v7-control-tower-page'] .ct-priority p{font-size:13px!important;line-height:1.45!important}
        main[data-testid='platform-v7-control-tower-page'] .ct-priority-panel{padding:14px!important;border-radius:19px!important;gap:9px!important}
        main[data-testid='platform-v7-control-tower-page'] .ct-priority-panel .ct-row:last-child{display:grid!important;grid-template-columns:1fr!important;gap:8px!important}
        main[data-testid='platform-v7-control-tower-page'] .ct-priority-panel .ct-row:last-child a:first-child{display:none!important}
        main[data-testid='platform-v7-control-tower-page'] .ct-priority-panel .ct-row:last-child a{min-height:52px!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:14px!important;border-radius:16px!important}
      }
      @media(max-width:374px){
        .pc-v4-actions{gap:5px!important}
        .pc-v4-actions button[aria-label='Идентификация и настройки']{width:40px!important;min-width:40px!important;max-width:40px!important;height:40px!important;min-height:40px!important}
      }
    `}</style>
  );
}
