import '@/styles/platform-v7-canonical-public-v1.css';
import { CanonicalUxState } from '@/components/platform-v7/CanonicalUxState';

export default function PlatformV7NotFound(){
  return <main className='pc-canonical-public'>
    <div className='pc-cp-container' style={{padding:'88px 0 110px'}}>
      <CanonicalUxState
        kind='empty'
        title='Страница или объект недоступны'
        description='Ссылка могла устареть, объект может быть закрыт для текущего контекста или не существовать. Внутренние идентификаторы и закрытые данные здесь не раскрываются.'
        actionHref='/platform-v7'
        actionLabel='На главную'
      />
    </div>
  </main>;
}
