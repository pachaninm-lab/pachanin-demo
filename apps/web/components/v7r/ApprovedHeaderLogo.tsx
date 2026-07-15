const CANONICAL_LOGO_SRC = '/icon/brand-primary?v=267b9bbb';

export default function HeaderLogo() {
  return (
    <span className='brand-logo-mark shrink-0' aria-hidden='true'>
      <img
        className='header-logo-image'
        src={CANONICAL_LOGO_SRC}
        alt=''
        width='128'
        height='128'
        loading='eager'
        decoding='async'
        fetchPriority='high'
        draggable={false}
      />
    </span>
  );
}
