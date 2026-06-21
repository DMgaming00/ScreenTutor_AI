import React from 'react';
import { createRoot } from 'react-dom/client';
import AnnotationOverlay from './components/AnnotationOverlay';
import { initRendererSentry } from './sentry';

initRendererSentry();

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <AnnotationOverlay />
    </React.StrictMode>
  );
}
