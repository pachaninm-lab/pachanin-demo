import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Прозрачная Цена',
    short_name: 'Прозрачная Цена',
    description: 'Цифровой контур исполнения зерновой сделки.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B1513',
    theme_color: '#0F5B4F',
    lang: 'ru',
    icons: [
      {
        src: '/icon?size=192',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon?size=512',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
