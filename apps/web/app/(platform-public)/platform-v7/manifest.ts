import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Прозрачная Цена',
    short_name: 'Прозрачная Цена',
    description: 'Цифровой контур исполнения зерновой сделки.',
    start_url: '/platform-v7',
    scope: '/platform-v7',
    display: 'standalone',
    background_color: '#f7faf7',
    theme_color: '#087a3b',
    orientation: 'any',
    lang: 'ru',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
        purpose: 'any',
      },
    ],
  };
}
