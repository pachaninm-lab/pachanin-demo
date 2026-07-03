'use client';

import { BRAND_LOGO_DATA_URI } from '@/components/v7r/brand-logo-asset';

export function LoginHeaderLogoGuard() {
  const css = `
  html body .pc-v7-login-single .login-top > a:first-of-type {
    display: inline-flex !important;
    align-items: center !important;
    gap: 10px !important;
    min-width: 0 !important;
    color: #071611 !important;
    text-decoration: none !important;
    font-weight: 950 !important;
  }

  html body .pc-v7-login-single .login-top > a:first-of-type::before {
    content: '' !important;
    display: inline-block !important;
    width: 42px !important;
    height: 42px !important;
    min-width: 42px !important;
    flex: 0 0 42px !important;
    background-image: url('${BRAND_LOGO_DATA_URI}') !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
  }

  @media (max-width: 520px) {
    html body .pc-v7-login-single .login-top > a:first-of-type::before {
      width: 42px !important;
      height: 42px !important;
      min-width: 42px !important;
      flex-basis: 42px !important;
    }
  }
  `;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
