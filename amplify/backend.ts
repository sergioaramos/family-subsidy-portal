import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';

// Los modelos de datos se agregan en T19 (F1).
defineBackend({
  auth,
});
