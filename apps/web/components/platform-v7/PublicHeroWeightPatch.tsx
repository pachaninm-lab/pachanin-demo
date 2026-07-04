export function PublicHeroWeightPatch() {
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

const css = `
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero h1,
.pc-shell-root-v4[data-public-entry='true'] .entry-hero h1{
  font-weight:780!important;
}
.pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero h1 span,
.pc-shell-root-v4[data-public-entry='true'] .entry-hero h1 span{
  font-weight:780!important;
}
html:has(.pc-v7-public-entry),
body:has(.pc-v7-public-entry),
.pc-shell-root-v4:has(.pc-v7-public-entry),
.pc-shell-root-v4:has(.pc-v7-public-entry) .pc-v4-main,
.pc-v7-public-entry{
  width:100%!important;
  max-width:100dvw!important;
  overflow-x:hidden!important;
}
.pc-v7-public-entry{
  position:relative!important;
  margin-inline:auto!important;
  contain:layout paint!important;
}
.pc-v7-public-entry .entry-header,
.pc-v7-public-entry .entry-hero,
.pc-v7-public-entry .entry-hero-copy,
.pc-v7-public-entry .entry-section,
.pc-v7-public-entry .entry-section-head,
.pc-v7-public-entry .entry-control-grid,
.pc-v7-public-entry .entry-role-grid,
.pc-v7-public-entry .entry-trust-strip{
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
.p7-register-page .p7-register-hero h1{
  text-wrap:balance!important;
}
html:has(.p7-contact-page),
body:has(.p7-contact-page),
.pc-shell-root-v4:has(.p7-contact-page),
.pc-shell-root-v4:has(.p7-contact-page) .pc-v4-main,
.p7-contact-page{
  width:100%!important;
  max-width:100dvw!important;
  overflow-x:hidden!important;
}
.p7-contact-page{
  margin-inline:auto!important;
  contain:layout paint!important;
}
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
.p7-contact-page .p7-contact-copy h1,
.p7-contact-page .p7-contact-copy p,
.p7-contact-page .p7-contact-info-card,
.p7-contact-page .p7-contact-info-card p,
.p7-contact-page .p7-contact-form p{
  overflow-wrap:anywhere!important;
  word-break:normal!important;
}
@media(max-width:720px){
  .pc-v7-public-entry{
    padding-left:0!important;
    padding-right:0!important;
    padding-bottom:calc(170px + env(safe-area-inset-bottom,0px))!important;
  }
  .pc-v7-public-entry .entry-header{
    left:0!important;
    right:0!important;
    width:100dvw!important;
    max-width:100dvw!important;
    grid-template-columns:minmax(0,1fr) auto!important;
    padding-left:max(12px,env(safe-area-inset-left,0px))!important;
    padding-right:max(12px,env(safe-area-inset-right,0px))!important;
    gap:8px!important;
    overflow:hidden!important;
  }
  .pc-v7-public-entry .entry-brand{
    min-width:0!important;
    max-width:calc(100dvw - 128px)!important;
    overflow:hidden!important;
  }
  .pc-v7-public-entry .entry-brand strong{
    display:block!important;
    max-width:100%!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
    font-size:clamp(16px,4.6vw,18px)!important;
  }
  .pc-v7-public-entry .entry-header-actions{
    flex:0 0 auto!important;
    max-width:108px!important;
    overflow:visible!important;
  }
  .pc-v7-public-entry .entry-login{
    min-width:88px!important;
    max-width:96px!important;
    padding:0 12px!important;
    white-space:nowrap!important;
  }
  .pc-v7-public-entry .entry-hero{
    width:100%!important;
    max-width:100%!important;
    margin:0 auto!important;
    padding:22px 12px 20px!important;
    display:grid!important;
    grid-template-columns:1fr!important;
    overflow:hidden!important;
  }
  .pc-v7-public-entry .entry-hero-copy{
    width:100%!important;
    max-width:100%!important;
    padding:22px 18px!important;
    border-radius:28px!important;
    overflow:hidden!important;
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
    overflow:hidden!important;
  }
  .pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero h1,
  .pc-shell-root-v4[data-public-entry='true'] .entry-hero h1,
  .pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero h1 span,
  .pc-shell-root-v4[data-public-entry='true'] .entry-hero h1 span{
    font-weight:760!important;
  }
  .p7-register-page .p7-register-hero h1{
    display:block!important;
    font-size:clamp(30px,7.8vw,34px)!important;
    line-height:1.07!important;
    letter-spacing:-.052em!important;
  }
  .p7-register-page .p7-register-hero h1 span{
    display:inline!important;
  }
  .p7-register-page .p7-register-hero h1 span:first-child::after{
    content:' '!important;
  }
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
  .p7-contact-page .p7-contact-copy{
    padding:22px 18px!important;
  }
  .p7-contact-page .p7-contact-copy h1{
    font-size:clamp(34px,9.2vw,42px)!important;
    line-height:1.02!important;
    letter-spacing:-.052em!important;
    text-wrap:balance!important;
  }
  .p7-contact-page .p7-contact-copy p{
    font-size:15.5px!important;
    line-height:1.45!important;
  }
  .p7-contact-page .p7-contact-cards,
  .p7-contact-page .p7-contact-form{
    grid-template-columns:1fr!important;
  }
}
@media(max-width:430px){
  .pc-v7-public-entry .entry-hero{
    padding-left:10px!important;
    padding-right:10px!important;
  }
  .pc-v7-public-entry .entry-hero-copy{
    padding:20px 16px!important;
  }
  .pc-v7-public-entry .entry-hero h1{
    font-size:clamp(32px,8.7vw,38px)!important;
    line-height:1.04!important;
  }
  .p7-register-page .p7-register-hero h1 span:first-child,
  .p7-register-page .p7-register-hero h1 span:last-child{
    font-size:0!important;
  }
  .p7-register-page .p7-register-hero h1 span:first-child::before{
    content:'Подключение компании'!important;
    font-size:clamp(30px,7.8vw,34px)!important;
    line-height:1.07!important;
  }
  .p7-register-page .p7-register-hero h1 span:first-child::after{
    content:'\A'!important;
    white-space:pre!important;
  }
  .p7-register-page .p7-register-hero h1 span:last-child::before{
    content:'к контуру сделки'!important;
    color:#15975a!important;
    font-size:clamp(30px,7.8vw,34px)!important;
    line-height:1.07!important;
    white-space:nowrap!important;
  }
}
`;
