import { BRAND_LOGO_DATA_URI } from '../../../web/components/v7r/brand-logo-asset';

export default function HeaderLogo() {
  return (
    <span className="brand-logo-mark shrink-0" aria-hidden="true">
      <img
        src={BRAND_LOGO_DATA_URI}
        alt=""
        width={48}
        height={48}
        className="header-logo-image"
        loading="eager"
        decoding="sync"
        draggable={false}
      />
    </span>
  );
}
