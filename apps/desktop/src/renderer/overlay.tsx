import React from 'react';
import { createRoot } from 'react-dom/client';
import AnnotationOverlay from './components/AnnotationOverlay';
import DictationGlow from './components/DictationGlow';
import { initRendererSentry } from './sentry';

initRendererSentry();

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <DictationGlow />
      <AnnotationOverlay />
    </React.StrictMode>
  );
}
