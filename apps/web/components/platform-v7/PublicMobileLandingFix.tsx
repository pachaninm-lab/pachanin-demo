'use client';

const publicMobileLandingCss = `
html body .pc-v7-public-entry{padding-top:0!important;overflow-x:hidden!important;background:linear-gradient(180deg,#edf5e9 0,#f6f9f3 118px,#f4f7f0 100%)!important}
html body .pc-v7-public-entry .entry-header{position:relative!important;top:auto!important;left:auto!important;right:auto!important;width:100%!important;max-width:100%!important;z-index:1!important;transform:none!important;overflow:visible!important}
html body .pc-v7-public-entry .entry-hero{padding-top:18px!important;min-height:0!important}
@media (max-width:720px){
html body .pc-v7-public-entry{padding-top:0!important}
html body .pc-v7-public-entry .entry-header{position:relative!important;top:auto!important;height:auto!important;min-height:68px!important;padding:10px 16px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;background:rgba(255,255,255,.98)!important;border-bottom:1px solid rgba(7,22,17,.08)!important;box-shadow:0 10px 24px rgba(7,22,17,.07)!important;overflow:visible!important}
html body .pc-v7-public-entry .entry-brand{display:flex!important;align-items:center!important;gap:10px!important;min-height:46px!important;max-width:calc(100% - 100px)!important;overflow:visible!important}
html body .pc-v7-public-entry .entry-brand-mark{width:42px!important;height:42px!important;min-width:42px!important;flex:0 0 42px!important;overflow:visible!important}
html body .pc-v7-public-entry .entry-brand strong{display:block!important;font-size:17px!important;line-height:1.18!important;letter-spacing:-.035em!important;white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;padding-top:1px!important}
html body .pc-v7-public-entry .entry-login{height:44px!important;min-height:44px!important;min-width:88px!important;padding:0 16px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border-radius:16px!important;overflow:visible!important}
html body .pc-v7-public-entry .entry-hero{padding:18px 14px 20px!important}
html body .pc-v7-public-entry .entry-hero-copy{margin-top:0!important}
}
@media (max-width:374px){
html body .pc-v7-public-entry .entry-header{min-height:64px!important;padding:9px 12px!important}
html body .pc-v7-public-entry .entry-brand-mark{width:38px!important;height:38px!important;min-width:38px!important;flex-basis:38px!important}
html body .pc-v7-public-entry .entry-hero{padding-top:16px!important}
}
`;

export function PublicMobileLandingFix() {
  return <style dangerouslySetInnerHTML={{ __html: publicMobileLandingCss }} />;
}
