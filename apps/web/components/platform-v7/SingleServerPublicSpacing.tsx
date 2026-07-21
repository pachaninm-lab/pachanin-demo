'use client';

export function SingleServerPublicSpacing() {
  return <style>{css}</style>;
}

const css = `
.pc-ppe-page{padding-bottom:calc(92px + env(safe-area-inset-bottom,0px));}
@media(max-width:760px){
  .pc-ppe-page > .pc-ppe-shell{padding-top:56px;}
  .pc-ppe-page .pc-site-header{height:56px!important;min-height:56px!important;padding-inline:12px!important;}
  .pc-ppe-page .pc-site-brand-mark{width:32px!important;height:32px!important;flex-basis:32px!important;}
  .pc-ppe-page .pc-site-brand-text strong{font-size:15px!important;}
  .pc-ppe-page .pc-ppe-shell{width:min(100% - 28px,1120px)!important;}
  .pc-ppe-page .pc-ppe-hero{display:block!important;padding:26px 0 18px!important;}
  .pc-ppe-page .pc-ppe-hero-copy{max-width:none!important;}
  .pc-ppe-page .pc-ppe-kicker{min-height:27px;padding:4px 9px;font-size:11px;border-radius:999px;}
  .pc-ppe-page .pc-ppe-hero h1{max-width:13ch;margin:12px 0 12px!important;font-size:clamp(34px,9.4vw,42px)!important;line-height:1.01!important;letter-spacing:-.045em!important;}
  .pc-ppe-page .pc-ppe-hero-copy > p{max-width:36ch;font-size:16px!important;line-height:1.42!important;}
  .pc-ppe-page .pc-ppe-public-status{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:4px 10px;margin-top:16px!important;padding:12px 13px!important;border:1px solid #bed8c6!important;border-left:1px solid #bed8c6!important;border-radius:15px!important;background:#f4faf6!important;box-shadow:none!important;}
  .pc-ppe-page .pc-ppe-public-status strong{font-size:15px!important;line-height:1.22!important;letter-spacing:-.01em!important;text-transform:none!important;}
  .pc-ppe-page .pc-ppe-public-status > span{display:-webkit-box;grid-column:1/-1;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:#496158;font-size:13px!important;line-height:1.4!important;font-weight:540!important;}
  .pc-ppe-page .pc-ppe-hero-actions{display:grid!important;grid-template-columns:1fr!important;gap:8px!important;margin-top:14px!important;}
  .pc-ppe-page .pc-ppe-primary-button,.pc-ppe-page .pc-ppe-secondary-button{min-height:47px!important;border-radius:12px!important;font-size:14px!important;}
  .pc-ppe-page .pc-ppe-secondary-button{background:transparent!important;}
  .pc-ppe-page .pc-ppe-hero-contour{min-height:0!important;margin-top:14px!important;padding:12px 14px!important;border-radius:15px!important;background:#f7faf8!important;}
  .pc-ppe-page .pc-ppe-hero-progress-mobile{min-height:68px!important;}
  .pc-ppe-page .pc-ppe-section{padding:32px 0!important;}
  .pc-ppe-page .pc-ppe-section:first-of-type{padding-top:22px!important;}
  .pc-ppe-page .pc-ppe-section-header{margin-bottom:20px!important;}
  .pc-ppe-page .pc-ppe-section-header h2,.pc-ppe-page .pc-ppe-evidence-panel h2,.pc-ppe-page .pc-ppe-final-cta h2{font-size:clamp(29px,8.2vw,36px)!important;line-height:1.08!important;}
  .pc-ppe-page .pc-ppe-section-header>p,.pc-ppe-page .pc-ppe-evidence-panel header>p,.pc-ppe-page .pc-ppe-final-cta>p{font-size:15px!important;line-height:1.48!important;}
  .pc-ppe-page .pc-ppe-preview-card{padding:18px!important;border-radius:17px!important;box-shadow:none!important;}
  .pc-ppe-page .pc-ppe-perspective-card{min-height:76px!important;padding:13px 14px!important;}
  .pc-ppe-page .pc-ppe-final-cta{padding:24px 18px!important;border-radius:18px!important;}
  .pc-ppe-page .pc-ppe-footer{padding-bottom:104px!important;}
}
@media(max-width:390px){
  .pc-ppe-page .pc-ppe-hero h1{font-size:34px!important;}
  .pc-ppe-page .pc-ppe-hero-copy > p{font-size:15px!important;}
  .pc-ppe-page .pc-ppe-public-status{padding:12px!important;}
}
`;
