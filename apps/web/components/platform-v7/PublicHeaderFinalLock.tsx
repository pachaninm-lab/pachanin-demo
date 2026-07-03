'use client';

const css = `
html body .pc-v7-public-entry{padding-top:86px!important;padding-bottom:150px!important;scroll-padding-top:86px!important}
html body .pc-v7-public-entry .entry-header{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:2000!important;width:100%!important;background:rgba(255,255,255,.98)!important;border-bottom:1px solid rgba(7,22,17,.08)!important;box-shadow:0 10px 24px rgba(7,22,17,.07)!important}
@media(max-width:720px){html body .pc-v7-public-entry{padding-top:86px!important}html body .pc-v7-public-entry .entry-header{height:70px!important;min-height:70px!important;padding:10px 16px!important;display:flex!important;align-items:center!important;justify-content:space-between!important}}
`;

export function PublicHeaderFinalLock(){return <style dangerouslySetInnerHTML={{__html:css}}/>}
