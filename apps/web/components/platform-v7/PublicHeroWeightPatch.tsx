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
.p7-register-page .p7-register-hero h1{
  text-wrap:balance!important;
}
html:has(.p7-contact-page),
body:has(.p7-contact-page),
.pc-shell-root-v4:has(.p7-contact-page),
.pc-shell-root-v4:has(.p7-contact-page) .pc-v4-main,
.p7-contact-page{
  width:100%!important;
  max-width:100vw!important;
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
@media(max-width:640px){
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
