import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WikiApp } from './WikiApp';
import '../ui/theme.css';
import './wiki.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <WikiApp />
    </StrictMode>,
  );
}
