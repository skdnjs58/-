import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Fix for MediaPipe/Emscripten "Aborted(Module.arguments has been replaced with plain arguments_)" error
(window as any).arguments = [];

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
