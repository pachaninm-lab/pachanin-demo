import { BRAND_LOGO_DATA_URI } from './brand-logo-asset';

export default function HeaderLogo() {
  return (
    <span className='brand-logo-mark shrink-0' aria-hidden='true'>
      <img
        className='header-logo-image'
        src={BRAND_LOGO_DATA_URI}
        alt=''
        width='64'
        height='64'
        loading='eager'
        decoding='sync'
        draggable={false}
      />
    </span>
  );
}
