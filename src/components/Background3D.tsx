import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
// @ts-ignore
import NET from 'vanta/dist/vanta.net.min';

export function Background3D() {
  const [vantaEffect, setVantaEffect] = useState<any>(null);
  const myRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!vantaEffect) {
      setVantaEffect(NET({
        el: myRef.current,
        THREE: THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.00,
        minWidth: 200.00,
        scale: 1.00,
        scaleMobile: 1.00,
        color: 0x6366f1, // Indigo accent
        backgroundColor: 0x09090b, // Very dark slate (our sr-bg)
        points: 10.00,
        maxDistance: 20.00,
        spacing: 20.00
      }));
    }
    return () => {
      if (vantaEffect) vantaEffect.destroy();
    };
  }, [vantaEffect]);

  return <div ref={myRef} style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }} />;
}
