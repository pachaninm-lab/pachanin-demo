'use client';

const publicMobileLandingCss = `
html body .pc-v7-public-entry,
html body .pc-shell-root-v4:has(.pc-v7-public-entry) .pc-v7-public-entry,
html body .pc-shell-root-v4[data-public-entry='true'] .pc-v7-public-entry{
  padding-top:0!important;
  overflow-x:hidden!important;
}

html body .pc-v7-public-entry .entry-header,
html body .pc-shell-root-v4:has(.pc-v7-public-entry) .entry-header,
html body .pc-shell-root-v4[data-public-entry='true'] .entry-header{
  position:sticky!important;
  top:0!important;
  left:auto!important;
  right:auto!important;
  z-index:1400!important;
  width:100%!important;
  max-width:100%!important;
}

html body .pc-v7-public-entry .entry-hero,
html body .pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero,
html body .pc-shell-root-v4[data-public-entry='true'] .entry-hero{
  padding-top:18px!important;
  min-height:0!important;
}

@media (max-width:720px){
  html body .pc-v7-public-entry,
  html body .pc-shell-root-v4:has(.pc-v7-public-entry) .pc-v7-public-entry,
  html body .pc-shell-root-v4[data-public-entry='true'] .pc-v7-public-entry{
    padding-top:0!important;
    background:linear-gradient(180deg,#eaf3e5 0,#f5f8f2 140px,#f4f7f0 100%)!important;
  }

  html body .pc-v7-public-entry .entry-header,
  html body .pc-shell-root-v4:has(.pc-v7-public-entry) .entry-header,
  html body .pc-shell-root-v4[data-public-entry='true'] .entry-header{
    position:sticky!important;
    top:0!important;
    height:70px!important;
    min-height:70px!important;
    padding:9px 16px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:space-between!important;
    gap:10px!important;
    background:rgba(255,255,255,.97)!important;
    border-bottom:1px solid rgba(7,22,17,.08)!important;
    box-shadow:0 12px 30px rgba(7,22,17,.08)!important;
    backdrop-filter:blur(18px)!important;
  }

  html body .pc-v7-public-entry .entry-hero,
  html body .pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero,
  html body .pc-shell-root-v4[data-public-entry='true'] .entry-hero{
    padding:18px 14px 20px!important;
  }

  html body .pc-v7-public-entry .entry-hero-copy,
  html body .pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero-copy,
  html body .pc-shell-root-v4[data-public-entry='true'] .entry-hero-copy{
    margin-top:0!important;
  }
}

@media (max-width:374px){
  html body .pc-v7-public-entry .entry-header,
  html body .pc-shell-root-v4:has(.pc-v7-public-entry) .entry-header,
  html body .pc-shell-root-v4[data-public-entry='true'] .entry-header{
    height:66px!important;
    min-height:66px!important;
    padding:8px 12px!important;
  }

  html body .pc-v7-public-entry .entry-hero,
  html body .pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero,
  html body .pc-shell-root-v4[data-public-entry='true'] .entry-hero{
    padding-top:16px!important;
  }
}
`;

export function PublicMobileLandingFix() {
  return <style dangerouslySetInnerHTML={{ __html: publicMobileLandingCss }} />;
}
