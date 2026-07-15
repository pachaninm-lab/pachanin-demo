import { APPROVED_LOGO_CHUNK_01 } from './approved-logo-chunks/chunk-01';
import { APPROVED_LOGO_CHUNK_02 } from './approved-logo-chunks/chunk-02';

const logoSrc = `data:image/webp;base64,${APPROVED_LOGO_CHUNK_01}${APPROVED_LOGO_CHUNK_02}`;

export default function HeaderLogo() {
  return (
    <span className='brand-logo-mark shrink-0' aria-hidden='true'>
      <img
        className='header-logo-image'
        src={logoSrc}
        alt=''
        width='120'
        height='120'
        loading='eager'
        decoding='sync'
        draggable={false}
      />
    </span>
  );
}
