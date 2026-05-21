import { SellerLotCreateRuntimeV2 } from '@/components/v7r/SellerLotCreateRuntimeV2';

export default function PlatformV7LotCreatePage() {
  return (
    <div data-testid="platform-v7-lot-create-page">
      <style>{`
        @media(max-width:767px){
          [data-testid='platform-v7-lot-create-page'] .lot-create-shell{gap:10px!important;padding-top:0!important}
          [data-testid='platform-v7-lot-create-page'] .lot-create-surface{padding:14px!important;border-radius:18px!important}
          [data-testid='platform-v7-lot-create-page'] .lot-create-shell > .lot-create-surface:first-child{padding:16px!important;border-radius:24px!important}
          [data-testid='platform-v7-lot-create-page'] .lot-create-top{display:grid!important;gap:8px!important}
          [data-testid='platform-v7-lot-create-page'] .lot-create-top > div:first-child > div:first-child{font-size:clamp(28px,8vw,38px)!important;line-height:1.04!important}
          [data-testid='platform-v7-lot-create-page'] .lot-create-top p,
          [data-testid='platform-v7-lot-create-page'] .lot-create-top a{display:none!important}
          [data-testid='platform-v7-lot-create-page'] .lot-create-grid{grid-template-columns:1fr!important;gap:10px!important}
          [data-testid='platform-v7-lot-create-page'] .lot-create-side{display:none!important}
          [data-testid='platform-v7-lot-create-page'] .lot-create-fields{grid-template-columns:1fr 1fr!important;gap:8px!important}
          [data-testid='platform-v7-lot-create-page'] .lot-create-fields:nth-of-type(3){display:none!important}
          [data-testid='platform-v7-lot-create-page'] .lot-create-main{gap:10px!important}
          [data-testid='platform-v7-lot-create-page'] .lot-create-main > label{padding:12px!important;border-radius:14px!important}
          [data-testid='platform-v7-lot-create-page'] .lot-create-actions{display:grid!important;grid-template-columns:1fr!important}
          [data-testid='platform-v7-lot-create-page'] .lot-create-actions a{display:none!important}
          [data-testid='platform-v7-lot-create-page'] .lot-create-actions button{width:100%!important;min-height:54px!important;border-radius:16px!important}
        }
      `}</style>
      <SellerLotCreateRuntimeV2 />
    </div>
  );
}
