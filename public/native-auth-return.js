(() => {
  'use strict';

  const status = document.getElementById('return-status');
  const returnLink = document.getElementById('return-to-app');
  const invalidLink = 'This sign-in link could not be completed. Return to sign in and try again.';

  try {
    const incoming = new URL(window.location.href);
    // Capture the one-use verifier before removing credentials from browser history.
    // This page never loads the auth SDK or exchanges the verifier in the browser.
    try { window.history.replaceState(null, '', incoming.pathname); } catch {}

    const parameters = incoming.searchParams;
    const states = parameters.getAll('state');
    const verifiers = parameters.getAll('neon_auth_session_verifier');
    const state = states[0] || '';
    const verifier = verifiers[0] || '';
    const validState = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(state);
    const validVerifier = verifier.length > 0 && verifier.length <= 2048 && !/[\s\u0000-\u001f\u007f-\u009f]/u.test(verifier);
    if (incoming.protocol !== 'https:' || states.length !== 1 || verifiers.length !== 1 || !validState || !validVerifier
      || parameters.has('error') || parameters.has('error_code') || parameters.has('error_description')) {
      throw new Error('Invalid account callback');
    }

    const target = new URL('pipwise://auth-callback');
    target.searchParams.set('neon_auth_session_verifier', verifier);
    target.searchParams.set('state', state);
    returnLink.href = target.href;
    returnLink.hidden = false;
    status.textContent = 'Continue in PipWise to finish signing in. If the app did not open, choose Open PipWise below.';
    try { window.location.replace(target.href); }
    catch { status.textContent = 'Choose Open PipWise below to finish signing in.'; }
  } catch {
    returnLink.hidden = true;
    returnLink.removeAttribute('href');
    status.textContent = invalidLink;
  }
})();
