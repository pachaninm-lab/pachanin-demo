'use client';
import { useEffect } from 'react';

export default function ControlLayout() {
  useEffect(() => {
    window.location.replace('/platform-v7/control-v8');
  }, []);
  return null;
}
