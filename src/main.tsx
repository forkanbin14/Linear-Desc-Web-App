import 'katex/dist/katex.min.css';
import { MotionConfig } from 'motion/react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './i18n/LanguageContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <MotionConfig reducedMotion="user">
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </MotionConfig>,
);
