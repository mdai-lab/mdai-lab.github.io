(() => {
const toggle = document.querySelector('.menu-toggle');
const menu = document.getElementById('master-menu');
const primaryNav = document.querySelector('.primary-nav');
const primaryLinks = [...document.querySelectorAll('.primary-nav [data-nav-key]')];
const overflowLinks = [...document.querySelectorAll('#master-menu [data-overflow-key]')];
const desktopNav = window.matchMedia('(hover: hover) and (pointer: fine)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let timer;

function enforceContentFontFloor() {
  const textElements = document.querySelectorAll('body :is(a,p,span,li,figcaption,summary,button,label,time,cite,small,dt,dd)');
  textElements.forEach(element => {
    if (element.closest('footer')) return;
    if (Number.parseFloat(getComputedStyle(element).fontSize) < 12) element.classList.add('content-font-floor');
  });
}
function cancelClose(){ clearTimeout(timer); }
function scheduleClose(){ clearTimeout(timer); timer=setTimeout(closeMenu,180); }

function layoutNavigation() {
  if (!primaryNav) return;
  const compact = !desktopNav.matches || innerWidth < 600;
  primaryNav.hidden = compact;
  primaryLinks.forEach(link => { link.hidden = compact; });
  if (!compact) {
    primaryNav.style.maxWidth = '';
    const label = document.querySelector('body > header .page-label');
    const labelRight = label?.getBoundingClientRect().right || 0;
    const toggleLeft = toggle?.getBoundingClientRect().left || innerWidth;
    primaryNav.style.maxWidth = `${Math.max(0, toggleLeft - labelRight - 60)}px`;
    for (let index = primaryLinks.length - 1; index >= 0 && primaryNav.scrollWidth > primaryNav.clientWidth + 1; index -= 1) {
      primaryLinks[index].hidden = true;
    }
  } else {
    primaryNav.style.maxWidth = '';
  }
  overflowLinks.forEach(link => {
    const primary = primaryLinks.find(item => item.dataset.navKey === link.dataset.overflowKey);
    link.hidden = Boolean(primary && !primary.hidden);
  });
}

function syncNavigationMode() {
  if (!menu || !toggle) return;
  clearTimeout(timer);
  menu.classList.remove('is-open');
  menu.hidden = true;
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Open website menu');
  layoutNavigation();
}

function closeMenu() {
  if (!menu || menu.hidden) return;
  menu.classList.remove('is-open');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Open website menu');
  clearTimeout(timer);
  timer = setTimeout(() => { menu.hidden = true; }, 220);
}

function openMenu() {
  if (!menu) return;
  clearTimeout(timer);
  menu.hidden = false;
  void menu.offsetWidth;
  menu.classList.add('is-open');
  toggle.setAttribute('aria-expanded', 'true');
  toggle.setAttribute('aria-label', 'Close website menu');
}

toggle?.addEventListener('click', event => {
  event.stopPropagation();
  if (menu.hidden) openMenu(); else closeMenu();
});
toggle?.addEventListener('pointerenter', event => { if(event.pointerType!=='touch') openMenu(); });
toggle?.addEventListener('pointerleave', scheduleClose);
menu?.addEventListener('pointerenter', cancelClose);
menu?.addEventListener('pointerleave', scheduleClose);
document.addEventListener('click', event => { if (menu && !menu.hidden && !menu.contains(event.target)) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
desktopNav.addEventListener('change', syncNavigationMode);
window.addEventListener('resize', layoutNavigation);
syncNavigationMode();
enforceContentFontFloor();

function smootherStepC3(value) {
  return value ** 4 * (35 - 84 * value + 70 * value ** 2 - 20 * value ** 3);
}

let navigationInProgress = false;
function transitionTo(destination) {
  if (navigationInProgress) return;
  navigationInProgress = true;
  if (reducedMotion.matches) {
    location.href = destination;
    return;
  }
  const black = document.createElement('div');
  black.className = 'page-transition-surface';
  document.body.append(black);
  const started = performance.now();
  function fadeOut(now) {
    const progress = Math.min(1, (now - started) / 300);
    black.style.opacity = String(smootherStepC3(progress));
    if (progress < 1) requestAnimationFrame(fadeOut);
    else {
      try { sessionStorage.setItem('site-transition-in', '1'); } catch {}
      location.href = destination;
    }
  }
  requestAnimationFrame(fadeOut);
}

function revealIncomingPage() {
  if (!document.documentElement.classList.contains('site-transition-in')) return;
  try { sessionStorage.removeItem('site-transition-in'); } catch {}
  const black = document.createElement('div');
  black.className = 'page-transition-surface';
  black.style.opacity = '1';
  document.body.append(black);
  document.documentElement.classList.remove('site-transition-in');
  const started = performance.now();
  function fadeIn(now) {
    const progress = Math.min(1, (now - started) / 300);
    black.style.opacity = String(1 - smootherStepC3(progress));
    if (progress < 1) requestAnimationFrame(fadeIn);
    else black.remove();
  }
  requestAnimationFrame(fadeIn);
}

document.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
  const destination = new URL(link.href, location.href);
  if (destination.origin !== location.origin) return;
  const canonicalPath = path => path.endsWith('/') ? `${path}index.html` : path;
  const samePage = canonicalPath(destination.pathname) === canonicalPath(location.pathname);
  if (samePage && !destination.hash) {
    event.preventDefault();
    closeMenu();
    window.scrollTo({top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth'});
    return;
  }
  if (!samePage && destination.pathname.endsWith('.html')) {
    event.preventDefault();
    transitionTo(destination.href);
  }
});
revealIncomingPage();
})();
