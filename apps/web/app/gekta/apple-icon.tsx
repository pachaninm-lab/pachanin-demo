import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';
export default function AppleIcon() { return new ImageResponse(<div style={{ width: '100%', height: '100%', borderRadius: 42, background: '#166534', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 94, fontWeight: 800, fontFamily: 'sans-serif' }}>G</div>, size); }
