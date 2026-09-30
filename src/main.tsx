import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { I18n } from 'aws-amplify/utils';
import { translations } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './index.css';
import outputs from '../amplify_outputs.json';
import App from './App';

// amplify_outputs.json lo genera el despliegue de cada ambiente (sandbox, dev, main): IDs y URL.
Amplify.configure(outputs);

// Textos del Authenticator en español.
I18n.putVocabularies(translations);
I18n.setLanguage('es');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
