'use client';

import * as React from 'react';
import { BRAND_LOGO_DATA_URI } from '@/components/v7r/brand-logo-asset';

function setLogo(){
  document.querySelectorAll<HTMLElement>('.pc-v7-public-entry .entry-brand-mark').forEach((mark)=>{
    mark.innerHTML='';
    const img=document.createElement('img');
    img.src=BRAND_LOGO_DATA_URI;
    img.alt='';
    img.draggable=false;
    mark.appendChild(img);
  });
}

export function PublicBrandLogoFinal(){
  React.useEffect(()=>{setLogo(); const t=[100,400,1000].map((d)=>window.setTimeout(setLogo,d)); return()=>t.forEach(clearTimeout)},[]);
  return null;
}
