const AppRouter = (() => {
  const paths = {
    home: '/',
    rules: '/rules',
    apiSettings: '/settings/api',
    account: '/account'
  };

  function getCurrentRoute() {
    const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
    const chatMatch = pathname.match(/^\/c\/([^/]+)$/);

    if (chatMatch) {
      try {
        return { name: 'chat', sessionId: decodeURIComponent(chatMatch[1]) };
      } catch (error) {
        return { name: 'notFound' };
      }
    }

    if (pathname === '/' && new URLSearchParams(window.location.search).has('c')) {
      return {
        name: 'chat',
        sessionId: new URLSearchParams(window.location.search).get('c'),
        legacy: true
      };
    }

    if (pathname === paths.rules) return { name: 'rules' };
    if (pathname === paths.apiSettings) return { name: 'apiSettings' };
    if (pathname === paths.account) return { name: 'account' };
    if (pathname === paths.home) return { name: 'home' };
    return { name: 'notFound' };
  }

  function notify(state = {}) {
    window.dispatchEvent(new CustomEvent('app:routechange', {
      detail: { route: getCurrentRoute(), state }
    }));
  }

  function navigate(path, { replace = false, skipNewChat = false } = {}) {
    const url = new URL(path, window.location.origin);
    const state = { skipNewChat };
    const historyMethod = replace ? 'replaceState' : 'pushState';
    window.history[historyMethod](state, '', `${url.pathname}${url.search}${url.hash}`);
    notify(state);
  }

  window.addEventListener('popstate', (event) => notify(event.state || {}));

  return {
    paths,
    getCurrentRoute,
    navigate,
    emitCurrent: () => notify({ initial: true })
  };
})();

window.AppRouter = AppRouter;
