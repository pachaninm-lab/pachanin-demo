import { SellerLotsRuntimeV2 } from '@/components/v7r/SellerLotsRuntimeV2';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';

export default function PlatformV7LotsPage() {
  return (
    <div data-testid="platform-v7-lots-page" style={{ display: 'grid', gap: 14 }}>
      <style>{`
        @media(max-width:767px){
          [data-testid='platform-v7-lots-page']{gap:10px!important}
          [data-testid='platform-v7-lots-page'] > div:first-child{display:none!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime']{gap:10px!important;padding-top:0!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:first-child{padding:16px!important;border-radius:24px!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:first-child p,
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:first-child a,
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:first-child span{display:none!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > div:nth-child(2){grid-template-columns:1fr 1fr!important;gap:8px!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > div:nth-child(2) > section{padding:12px!important;border-radius:16px!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > div:nth-child(2) > section:nth-child(n+3){display:none!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:nth-child(n+5){display:none!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:nth-child(3){padding:14px!important;border-radius:18px!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:nth-child(3) input:nth-of-type(n+3){display:none!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:nth-child(3) button{min-height:54px!important;border-radius:16px!important;width:100%!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:nth-child(4){padding:14px!important;border-radius:22px!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:nth-child(4) article:nth-of-type(n+2){display:none!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:nth-child(4) article{padding:13px!important;border-radius:16px!important}
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <TrustDot state='test' size='sm' label='тестовый контур' />
      </div>
      <SellerLotsRuntimeV2 />
    </div>
  );
}
