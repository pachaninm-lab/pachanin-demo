import '@/styles/platform-v7-canonical-public-v1.css';
import { BrandMark } from '@/components/v7r/BrandMark';
import { CanonicalUxState } from '@/components/platform-v7/CanonicalUxState';

export default function PlatformV7Loading(){
  return <main className='pc-canonical-public'>
    <div className='pc-cp-container' style={{padding:'calc(env(safe-area-inset-top,0px) + 86px) 0 calc(env(safe-area-inset-bottom,0px) + 90px)'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}><BrandMark size={38}/><strong>Прозрачная Цена</strong></div>
      <CanonicalUxState kind='loading' title='Загружаем экран платформы' description='Проверяем доступные данные. Если источник не ответил, примерные значения не показываем.'/>
    </div>
  </main>;
}
