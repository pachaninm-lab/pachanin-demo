'use client';

import { useState } from 'react';

export function FavoriteButton({ initial = false }: { initial?: boolean }) {
  const [active, setActive] = useState(initial);
  return <button className="mini-chip" onClick={() => setActive((v) => !v)}>{active ? '★ saved' : '☆ save'}</button>;
}
