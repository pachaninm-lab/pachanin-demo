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
