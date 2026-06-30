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
@media(max-width:640px){
  .pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero h1,
  .pc-shell-root-v4[data-public-entry='true'] .entry-hero h1,
  .pc-shell-root-v4:has(.pc-v7-public-entry) .entry-hero h1 span,
  .pc-shell-root-v4[data-public-entry='true'] .entry-hero h1 span{
    font-weight:760!important;
  }
}
`;
