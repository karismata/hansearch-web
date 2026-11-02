import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > 480);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  if (!visible) return null;
  return <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'auto' })} aria-label="맨 위로" title="맨 위로"
    style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
    className="fixed right-5 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500"><ArrowUp size={20} /></button>;
}

