import { SellerLotsRuntimeV2 } from '@/components/v7r/SellerLotsRuntimeV2';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { PricePredictorWidget } from '@/components/platform-v7/PricePredictorWidget';

export default function PlatformV7LotsPage() {
  return (
    <div data-testid="platform-v7-lots-page" style={{ display: 'grid', gap: 14, width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'clip' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        [data-testid='platform-v7-lots-page']{max-width:100%!important;overflow-x:hidden!important}
        [data-testid='platform-v7-lots-page'] *{min-width:0;overflow-wrap:anywhere;box-sizing:border-box}
        [data-testid='platform-v7-lots-page'] input,
        [data-testid='platform-v7-lots-page'] textarea,
        [data-testid='platform-v7-lots-page'] select{max-width:100%!important;font-size:16px!important}
        [data-testid='platform-v7-lots-page'] button,
        [data-testid='platform-v7-lots-page'] a{max-width:100%!important;white-space:normal!important}
        [data-testid='platform-v7-lots-page'] table{display:block!important;max-width:100%!important;overflow-x:auto!important}
        @media(max-width:767px){
          [data-testid='platform-v7-lots-page']{gap:10px!important}
          [data-testid='platform-v7-lots-page'] > div:first-child{display:none!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime']{gap:10px!important;padding-top:0!important;max-width:100%!important;overflow-x:hidden!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:first-child{padding:16px!important;border-radius:24px!important;overflow:hidden!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:first-child p,
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:first-child a,
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:first-child span{display:none!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > div:nth-child(2){grid-template-columns:1fr 1fr!important;gap:8px!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > div:nth-child(2) > section{padding:12px!important;border-radius:16px!important;overflow:hidden!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > div:nth-child(2) > section:nth-child(n+3){display:none!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:nth-child(n+5){display:none!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:nth-child(3){padding:14px!important;border-radius:18px!important;overflow:hidden!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:nth-child(3) input:nth-of-type(n+3){display:none!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:nth-child(3) button{min-height:54px!important;border-radius:16px!important;width:100%!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:nth-child(4){padding:14px!important;border-radius:22px!important;overflow:hidden!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:nth-child(4) article:nth-of-type(n+2){display:none!important}
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > section:nth-child(4) article{padding:13px!important;border-radius:16px!important;overflow:hidden!important}
        }
        @media(max-width:380px){
          [data-testid='platform-v7-lots-page'] [data-testid='platform-v7-lots-runtime'] > div:nth-child(2){grid-template-columns:1fr!important}
        }
      ` }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>
        <TrustDot state='test' size='sm' label='тестовый контур' />
      </div>
      <CollapsibleSection title='ML-прогноз цены' summary='scikit-learn · 6 культур · 5 регионов · 30 дней' defaultOpen={false}>
        <PricePredictorWidget />
      </CollapsibleSection>
      <SellerLotsRuntimeV2 />
    </div>
  );
}
