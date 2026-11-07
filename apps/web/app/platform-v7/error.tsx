'use client';

import '@/styles/platform-v7-canonical-public-v1.css';
import Link from 'next/link';
import { CanonicalUxState } from '@/components/platform-v7/CanonicalUxState';

export default function PlatformV7Error({reset}:{error:Error;reset:()=>void}){
  return <main className='pc-canonical-public'>
    <div className='pc-cp-container' style={{padding:'88px 0 110px'}}>
      <CanonicalUxState
        kind='retry'
        title='Не удалось загрузить экран'
        description='Данные не подменены последним известным или примерным значением. Повтори запрос; если ошибка сохраняется, вернись ко входу.'
        action={<div className='pc-cp-actions'><button className='pc-cp-button pc-cp-button--secondary' type='button' onClick={reset}>Повторить</button><Link className='pc-cp-button' href='/platform-v7/login'>Перейти ко входу</Link></div>}
      />
    </div>
  </main>;
}
