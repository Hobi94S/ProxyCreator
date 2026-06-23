import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

function showBootError(message) {
  const bootStatus = document.getElementById('boot-status');

  if (!bootStatus) {
    return;
  }

  const heading = bootStatus.querySelector('h1');
  const paragraphs = bootStatus.querySelectorAll('p');

  if (heading) {
    heading.textContent = 'App failed to start';
  }

  if (paragraphs[0]) {
    paragraphs[0].textContent = message;
  }

  if (paragraphs[1]) {
    paragraphs[1].textContent = 'Open the browser console for the full stack trace.';
  }
}

async function bootstrap() {
  try {
    const { default: App } = await import('./App');

    window.__APP_LOADED__ = true;
    document.getElementById('boot-status')?.remove();

    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  } catch (error) {
    console.error('Failed to bootstrap app', error);
    const message = error instanceof Error ? error.message : 'Unknown startup error.';
    showBootError(message);
  }
}

bootstrap();
