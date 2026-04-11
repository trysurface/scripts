type RouteChangeCallback = (newUrl: string) => void;

const callbacks: RouteChangeCallback[] = [];
let installed = false;
let currentUrl = "";

export function onRouteChange(callback: RouteChangeCallback): void {
  callbacks.push(callback);

  if (!installed) {
    install();
    installed = true;
  }
}

function notify(): void {
  const newUrl = window.location.href;
  if (newUrl === currentUrl) return;

  currentUrl = newUrl;
  callbacks.forEach((cb) => cb(newUrl));
}

function install(): void {
  currentUrl = window.location.href;

  window.addEventListener("popstate", notify);

  const origPush = history.pushState;
  const origReplace = history.replaceState;

  history.pushState = function (...args) {
    origPush.apply(history, args);
    setTimeout(notify, 0);
  };

  history.replaceState = function (...args) {
    origReplace.apply(history, args);
    setTimeout(notify, 0);
  };
}
