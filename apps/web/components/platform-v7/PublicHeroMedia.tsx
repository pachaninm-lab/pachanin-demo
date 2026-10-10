/**
 * The approved 3,998-byte SVG, inlined only for the first-screen image.
 * Keeping the same image element preserves sizing, crop, filters and LCP
 * eligibility while removing its network dependency from the critical path.
 * The byte-for-byte regression against the public asset prevents visual drift.
 * No browser code, filesystem read or request-time transformation is needed.
 */
const HERO_SOURCE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 720" role="img" aria-label="Agricultural field connected to elevator and logistics">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7fbf6"/><stop offset=".58" stop-color="#e6f2e8"/><stop offset="1" stop-color="#d8eadf"/></linearGradient>
    <linearGradient id="field" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#bfdcaa"/><stop offset=".55" stop-color="#9cc77f"/><stop offset="1" stop-color="#789f61"/></linearGradient>
    <linearGradient id="road" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#d8d6c9"/><stop offset="1" stop-color="#bfc4b7"/></linearGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#edf1ec"/><stop offset=".5" stop-color="#cfd9d2"/><stop offset="1" stop-color="#aebdb4"/></linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#234c39" flood-opacity=".10"/></filter>
  </defs>
  <rect width="1600" height="720" fill="url(#sky)"/>
  <circle cx="1320" cy="122" r="92" fill="#fff7d7" opacity=".68"/>
  <path d="M0 338 C250 286 458 330 662 294 C894 254 1130 286 1600 236 L1600 720 L0 720Z" fill="#dbe8c7"/>
  <path d="M0 400 C280 334 518 378 756 334 C1040 282 1274 314 1600 280 L1600 720 L0 720Z" fill="url(#field)"/>
  <g opacity=".36" stroke="#eef6df" stroke-width="4">
    <path d="M80 720 L590 376"/><path d="M210 720 L650 366"/><path d="M355 720 L720 350"/><path d="M520 720 L790 340"/><path d="M690 720 L862 330"/>
  </g>
  <g opacity=".22" stroke="#4d7b55" stroke-width="2">
    <path d="M0 500 C260 452 450 470 708 426"/><path d="M0 560 C270 510 486 526 746 478"/><path d="M0 624 C306 566 516 592 786 536"/>
  </g>
  <path d="M784 720 C912 620 1030 560 1168 528 C1322 492 1452 500 1600 522 L1600 720Z" fill="url(#road)"/>
  <path d="M938 720 C1036 628 1160 580 1326 550" fill="none" stroke="#f6f5eb" stroke-width="10" stroke-linecap="round" opacity=".9"/>
  <g filter="url(#soft)" transform="translate(1020 194)">
    <rect x="0" y="176" width="322" height="116" rx="8" fill="#d7e1da"/>
    <rect x="34" y="72" width="70" height="210" rx="31" fill="url(#steel)"/><ellipse cx="69" cy="72" rx="35" ry="14" fill="#e7ede9"/>
    <rect x="118" y="44" width="76" height="238" rx="34" fill="url(#steel)"/><ellipse cx="156" cy="44" rx="38" ry="15" fill="#eef2ef"/>
    <rect x="210" y="92" width="66" height="190" rx="29" fill="url(#steel)"/><ellipse cx="243" cy="92" rx="33" ry="13" fill="#e7ede9"/>
    <rect x="286" y="128" width="24" height="164" fill="#8ca39a"/>
    <path d="M298 128 L345 94 L352 103 L306 142Z" fill="#789188"/>
    <rect x="20" y="194" width="270" height="16" fill="#9eb2a8"/>
  </g>
  <g filter="url(#soft)" transform="translate(1268 488)">
    <rect x="0" y="30" width="174" height="62" rx="12" fill="#f7faf8" stroke="#9eb6a8" stroke-width="3"/>
    <path d="M174 49 H232 L262 74 V92 H174Z" fill="#0a6046"/>
    <rect x="196" y="57" width="31" height="18" rx="3" fill="#dff1e6"/>
    <circle cx="52" cy="98" r="19" fill="#26382f"/><circle cx="52" cy="98" r="8" fill="#bdc8c0"/>
    <circle cx="212" cy="98" r="19" fill="#26382f"/><circle cx="212" cy="98" r="8" fill="#bdc8c0"/>
    <path d="M24 52 H148" stroke="#c0d6c8" stroke-width="4"/><path d="M24 66 H126" stroke="#d7e7dd" stroke-width="4"/>
  </g>
  <g fill="none" stroke="#2e7a5c" stroke-width="2.5" opacity=".54">
    <path d="M520 476 C748 386 900 420 1118 330"/>
    <path d="M1118 330 C1240 348 1322 422 1380 520"/>
  </g>
  <g fill="#ffffff" stroke="#2e7a5c" stroke-width="3">
    <circle cx="520" cy="476" r="8"/><circle cx="752" cy="402" r="8"/><circle cx="930" cy="398" r="8"/><circle cx="1118" cy="330" r="9"/><circle cx="1248" cy="374" r="8"/><circle cx="1380" cy="520" r="9"/>
  </g>
  <g opacity=".20" fill="#0a6046"><circle cx="682" cy="190" r="4"/><circle cx="760" cy="226" r="3"/><circle cx="880" cy="176" r="4"/><circle cx="948" cy="242" r="3"/></g>
</svg>`;
const HERO_DATA_URI = `data:image/svg+xml,${encodeURIComponent(HERO_SOURCE)}`;

export function PublicHeroMedia() {
  return <img className='pc-cp-hero-media' src={HERO_DATA_URI} alt='' width='400' height='320' loading='eager' decoding='sync' fetchPriority='high' aria-hidden='true' />;
}
