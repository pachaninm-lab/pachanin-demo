export function PublicHeroWeightPatch() {
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

const css = `
.pc-v7-public-entry .entry-hero h1,
.pc-v7-public-entry .entry-hero h1 span{
  font-weight:780!important;
}
.pc-v7-public-entry,
.p7-contact-page{
  width:100%!important;
  max-width:100%!important;
  overflow-x:hidden!important;
}
.pc-v7-public-entry .entry-header,
.pc-v7-public-entry .entry-hero,
.pc-v7-public-entry .entry-hero-copy,
.pc-v7-public-entry .entry-section,
.pc-v7-public-entry .entry-section-head,
.pc-v7-public-entry .entry-control-grid,
.pc-v7-public-entry .entry-role-grid,
.pc-v7-public-entry .entry-trust-strip,
.p7-contact-page .p7-contact-header,
.p7-contact-page .p7-contact-layout,
.p7-contact-page .p7-contact-copy,
.p7-contact-page .p7-contact-form-card,
.p7-contact-page .p7-contact-cards,
.p7-contact-page .p7-contact-info-card,
.p7-contact-page .p7-contact-form{
  max-width:100%!important;
  min-width:0!important;
}
.pc-v7-public-entry .entry-hero h1,
.pc-v7-public-entry .entry-hero p,
.pc-v7-public-entry .entry-section-head h2,
.pc-v7-public-entry .entry-section-head p,
.pc-v7-public-entry .entry-primary-cta,
.pc-v7-public-entry .entry-secondary-cta,
.pc-v7-public-entry .entry-register-cta{
  overflow-wrap:normal!important;
  word-break:normal!important;
}
.p7-contact-page .p7-contact-copy h1,
.p7-contact-page .p7-contact-copy p,
.p7-contact-page .p7-contact-info-card,
.p7-contact-page .p7-contact-info-card p,
.p7-contact-page .p7-contact-form p{
  overflow-wrap:anywhere!important;
  word-break:normal!important;
}
.p7-register-page .p7-register-hero h1{
  text-wrap:balance!important;
}
@media(max-width:720px){
  .pc-v7-public-entry .entry-hero{
    width:100%!important;
    max-width:100%!important;
    margin:0 auto!important;
    padding:22px 12px 20px!important;
    display:grid!important;
    grid-template-columns:1fr!important;
  }
  .pc-v7-public-entry .entry-hero-copy{
    width:100%!important;
    max-width:100%!important;
    padding:22px 18px!important;
    border-radius:28px!important;
  }
  .pc-v7-public-entry .entry-kicker{
    max-width:100%!important;
    width:auto!important;
    min-width:0!important;
    white-space:normal!important;
    text-align:center!important;
    justify-content:center!important;
    padding:8px 12px!important;
    font-size:clamp(10px,3vw,12px)!important;
    line-height:1.2!important;
  }
  .pc-v7-public-entry .entry-hero h1{
    display:block!important;
    width:100%!important;
    max-width:100%!important;
    font-size:clamp(34px,9.1vw,42px)!important;
    line-height:1.03!important;
    letter-spacing:-.055em!important;
    text-wrap:balance!important;
  }
  .pc-v7-public-entry .entry-hero h1 span{
    display:block!important;
    max-width:100%!important;
  }
  .pc-v7-public-entry .entry-hero p{
    max-width:100%!important;
    font-size:clamp(15.5px,4.2vw,17px)!important;
    line-height:1.43!important;
  }
  .pc-v7-public-entry .entry-hero-actions{
    display:grid!important;
    grid-template-columns:1fr!important;
    width:100%!important;
    gap:10px!important;
  }
  .pc-v7-public-entry .entry-primary-cta,
  .pc-v7-public-entry .entry-secondary-cta,
  .pc-v7-public-entry .entry-register-cta{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    padding:0 14px!important;
    text-align:center!important;
    white-space:normal!important;
  }
  .p7-register-page .p7-register-hero h1{
    display:block!important;
    font-size:clamp(30px,7.8vw,34px)!important;
    line-height:1.07!important;
    letter-spacing:-.052em!important;
  }
  .p7-register-page .p7-register-hero h1 span{display:inline!important}
  .p7-contact-page{
    padding-left:max(12px,env(safe-area-inset-left,0px))!important;
    padding-right:max(12px,env(safe-area-inset-right,0px))!important;
    padding-bottom:calc(170px + env(safe-area-inset-bottom,0px))!important;
  }
  .p7-contact-page .p7-contact-header{
    left:auto!important;
    right:auto!important;
    width:100%!important;
    grid-template-columns:minmax(0,1fr) auto!important;
    padding-left:12px!important;
    padding-right:12px!important;
  }
  .p7-contact-page .p7-contact-layout{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:14px!important;
    width:100%!important;
    padding-top:18px!important;
  }
  .p7-contact-page .p7-contact-copy,
  .p7-contact-page .p7-contact-form-card{
    width:100%!important;
    border-radius:26px!important;
  }
}
@media(max-width:430px){
  .pc-v7-public-entry .entry-hero{padding-left:10px!important;padding-right:10px!important}
  .pc-v7-public-entry .entry-hero-copy{padding:20px 16px!important}
  .pc-v7-public-entry .entry-hero h1{font-size:clamp(32px,8.7vw,38px)!important;line-height:1.04!important}
}
`;
