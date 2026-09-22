const sections = [...document.querySelectorAll('.scene[id]')];
const backgrounds = [...document.querySelectorAll('.fixed-background')];
const links = [...document.querySelectorAll('.topics a')];


let scheduled = false;
let snapTimer;
let snapFrame;
let snapAnimating = false;
let activelyScrolling = false;
let scrollIdleTimer;

function cancelSoftAlignment() {
  clearTimeout(snapTimer);
  if (snapFrame) cancelAnimationFrame(snapFrame);
  snapFrame = null;
  snapAnimating = false;
}

function smootherStepC3(progress) {
  const squared = progress * progress;
  const fourth = squared * squared;
  return fourth * (35 + progress * (-84 + progress * (70 - 20 * progress)));
}

function glideTo(targetY) {
  cancelSoftAlignment();
  const startY = scrollY;
  const distance = targetY - startY;
  if (Math.abs(distance) < 2) return;
  if (reducedMotion.matches) {
    scrollTo(0, targetY);
    return;
  }
  const duration = Math.min(1680, Math.max(1120, Math.abs(distance) * 6.4));
  let started;
  snapAnimating = true;
  const step = now => {
    if (started === undefined) started = now;
    const progress = Math.min(1, (now - started) / duration);
    // Seventh-order trajectory: velocity, acceleration, and jerk are
    // continuous and reach zero at both endpoints.
    const eased = smootherStepC3(progress);
    scrollTo(0, startY + distance * eased);
    if (progress < 1) snapFrame = requestAnimationFrame(step);
    else {
      snapFrame = null;
      snapAnimating = false;
    }
  };
  snapFrame = requestAnimationFrame(step);
}

function softlyAlignNearbyTopic() {
  const nearest = sections
    .map(section => ({ section, distance: Math.abs(section.getBoundingClientRect().top) }))
    .sort((a, b) => a.distance - b.distance)[0];
  if (!nearest || nearest.distance > innerHeight * .2 || nearest.distance < 2) return;
  glideTo(scrollY + nearest.section.getBoundingClientRect().top);
}

function updateScene() {
  scheduled = false;
  const current = sections.find(section => {
    const rect = section.getBoundingClientRect();
    const visible = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
    return visible > innerHeight / 2;
  });
  // At an exact 50/50 boundary, preserve the current background until one
  // topic has a true majority of the viewport.
  if (!current) return;
  const backgroundTopic = current.dataset.backgroundTopic || current.id;
  backgrounds.forEach(image => image.classList.toggle('active', image.dataset.topic === backgroundTopic));
  links.forEach(link => {
    if (link.hash === `#${current.id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
addEventListener('scroll', () => {
  activelyScrolling = true;
  clearTimeout(scrollIdleTimer);
  scrollIdleTimer = setTimeout(() => { activelyScrolling = false; }, 140);
  if (!snapAnimating) {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(softlyAlignNearbyTopic, 100);
  }
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(updateScene);
  }
}, { passive: true });
addEventListener('resize', updateScene);
['wheel', 'touchstart', 'pointerdown'].forEach(type => addEventListener(type, cancelSoftAlignment, { passive: true }));
addEventListener('keydown', event => {
  if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)) cancelSoftAlignment();
});

let returnFocus;
let activePanel = null;
const figureViewer = document.getElementById('research-figure-viewer');
let figureReturnFocus;
let figureButtons = [];
let figureIndex = 0;
let hoverOpened = false;
let hideTimer;
const inside = new Set();
const panelTimers = new WeakMap();
const narrowScreen = matchMedia('(max-width: 1199px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const transitionDuration = 520;
const menuToggle = document.querySelector('.menu-toggle');
const masterMenu = document.getElementById('master-menu');
let menuTimer;

function closeMenu() {
  if (!masterMenu || masterMenu.hidden) return;
  masterMenu.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Open website menu');
  clearTimeout(menuTimer);
  menuTimer = setTimeout(() => { masterMenu.hidden = true; }, 220);
}

function openMenu() {
  if (!masterMenu) return;
  clearTimeout(menuTimer);
  masterMenu.hidden = false;
  void masterMenu.offsetWidth;
  masterMenu.classList.add('is-open');
  menuToggle.setAttribute('aria-expanded', 'true');
  menuToggle.setAttribute('aria-label', 'Close website menu');
}

menuToggle?.addEventListener('click', event => {
  event.stopPropagation();
  if (masterMenu.hidden) openMenu();
  else closeMenu();
});
document.querySelectorAll('[data-scroll-target]').forEach(link => link.addEventListener('click', event => {
  const target = document.querySelector(link.dataset.scrollTarget);
  if (!target) return;
  event.preventDefault();
  history.pushState(null, '', link.getAttribute('href'));
  glideTo(scrollY + target.getBoundingClientRect().top);
}));
menuToggle?.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') openMenu(); });
menuToggle?.addEventListener('pointerleave', () => { clearTimeout(menuTimer); menuTimer = setTimeout(closeMenu, 180); });
masterMenu?.addEventListener('pointerenter', () => clearTimeout(menuTimer));
masterMenu?.addEventListener('pointerleave', () => { clearTimeout(menuTimer); menuTimer = setTimeout(closeMenu, 180); });

function cancelHide() { clearTimeout(hideTimer); }

function scheduleHide() {
  cancelHide();
  if (figureViewer && !figureViewer.hidden) return;
  if (!activePanel || !hoverOpened) return;
  hideTimer = setTimeout(() => {
    const area = returnFocus?.closest('.topic-hover');
    if (activePanel && !inside.has(area) && !inside.has(activePanel) && !activePanel.contains(document.activeElement)) closePanel(false);
  }, 100);
}

function closePanel(restore = true) {
  cancelHide();
  if (!activePanel) return;
  const panel = activePanel;
  const trigger = returnFocus;
  const hadFocus = panel.contains(document.activeElement);
  activePanel = null;
  hoverOpened = false;
  panel.classList.remove('is-visible');
  panel.inert = true;
  clearTimeout(panelTimers.get(panel));
  const finish = () => { panel.hidden = true; };
  if (reducedMotion.matches) finish();
  else panelTimers.set(panel, setTimeout(finish, transitionDuration));
  panel.removeAttribute('aria-modal');
  document.body.classList.remove('detail-open');
  trigger?.setAttribute('aria-expanded', 'false');
  trigger?.removeAttribute('aria-disabled');
  if (restore && hadFocus) trigger?.focus({ preventScroll: true });
}

function openPanel(target, source) {
  const panel = document.getElementById(target.dataset.open);
  cancelHide();
  if (!panel) return;
  if (activePanel === panel) {
    if (source === 'click') {
      hoverOpened = false;
      panel.querySelector('.close-detail').focus({ preventScroll: true });
    }
    return;
  }
  closePanel(false);
  returnFocus = target;
  activePanel = panel;
  hoverOpened = source === 'hover';
  target.setAttribute('aria-expanded', 'true');
  target.setAttribute('aria-disabled', 'true');
  clearTimeout(panelTimers.get(panel));
  panel.hidden = false;
  panel.inert = false;
  void panel.offsetWidth;
  panel.classList.add('is-visible');
  if (narrowScreen.matches) {
    panel.setAttribute('aria-modal', 'true');
    document.body.classList.add('detail-open');
  }
  panel.scrollTop = 0;
  if (source !== 'hover') panel.querySelector('.close-detail').focus({ preventScroll: true });
}

document.querySelectorAll('.topic-hover').forEach(area => {
  const target = area.querySelector('[data-open]');
  area.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch') return;
    if (!activelyScrolling && !snapAnimating) {
      const scene = area.closest?.('.scene');
      if (scene) {
        const rect = scene.getBoundingClientRect();
        glideTo(scrollY + rect.top + (rect.height - innerHeight) / 2);
      }
    }
    if (narrowScreen.matches) return;
    inside.add(area);
    openPanel(target, 'hover');
  });
  area.addEventListener('pointerleave', () => {
    inside.delete(area);
    if (snapAnimating) return;
    scheduleHide();
  });
  target.addEventListener('click', event => {
    event.preventDefault();
    openPanel(target, 'click');
  });
});

document.querySelectorAll('.research-detail').forEach(panel => {
  panel.addEventListener('pointerenter', () => { inside.add(panel); cancelHide(); });
  panel.addEventListener('pointerleave', () => { inside.delete(panel); scheduleHide(); });
  panel.addEventListener('focusin', cancelHide);
  panel.addEventListener('focusout', scheduleHide);
  panel.querySelector('.close-detail').addEventListener('click', () => closePanel());
});

function closeFigureViewer() {
  if (!figureViewer || figureViewer.hidden) return;
  figureViewer.hidden = true;
  document.body.classList.remove('figure-viewer-open');
  if (activePanel) activePanel.inert = false;
  figureViewer.querySelector('img').removeAttribute('src');
  figureReturnFocus?.focus({ preventScroll: true });
  figureReturnFocus = null;
  figureButtons = [];
  figureIndex = 0;
}

function showFigure(index) {
  if (!figureViewer || !figureButtons.length) return;
  figureIndex = Math.max(0, Math.min(index, figureButtons.length - 1));
  const button = figureButtons[figureIndex];
  const image = button.querySelector('img');
  const expanded = figureViewer.querySelector('img');
  expanded.src = image.getAttribute('src');
  expanded.alt = image.alt;
  figureViewer.querySelector('figcaption').textContent = button.closest('figure').querySelector('figcaption')?.textContent || '';
  const detail = button.closest('figure').querySelector('.figure-description-text');
  const description = figureViewer.querySelector('.figure-viewer-description');
  const descriptionText = description.querySelector('.figure-viewer-description-text');
  descriptionText.textContent = detail?.textContent || '';
  description.hidden = !descriptionText.textContent.trim();
  const multiple = figureButtons.length > 1;
  figureViewer.querySelector('.figure-viewer-prev').hidden = !multiple || figureIndex === 0;
  figureViewer.querySelector('.figure-viewer-next').hidden = !multiple || figureIndex === figureButtons.length - 1;
  const count = figureViewer.querySelector('.figure-viewer-count');
  count.hidden = !multiple;
  count.textContent = multiple ? `Figure ${figureIndex + 1} of ${figureButtons.length}` : '';
}

document.querySelectorAll('.research-figure-open').forEach(button => button.addEventListener('click', () => {
  if (!figureViewer) return;
  cancelHide();
  figureReturnFocus = button;
  figureButtons = [...button.closest('.research-detail').querySelectorAll('.research-figure-open')];
  showFigure(figureButtons.indexOf(button));
  if (activePanel) activePanel.inert = true;
  figureViewer.hidden = false;
  document.body.classList.add('figure-viewer-open');
  figureViewer.querySelector('.figure-viewer-close').focus({ preventScroll: true });
}));
figureViewer?.querySelector('.figure-viewer-close').addEventListener('click', event => { event.stopPropagation(); closeFigureViewer(); });
figureViewer?.querySelector('.figure-viewer-prev').addEventListener('click', () => showFigure(figureIndex - 1));
figureViewer?.querySelector('.figure-viewer-next').addEventListener('click', () => showFigure(figureIndex + 1));
figureViewer?.addEventListener('click', event => { if (event.target === figureViewer) { event.stopPropagation(); closeFigureViewer(); } });

document.addEventListener('keydown', event => {
  if (figureViewer && !figureViewer.hidden) {
    if (event.key === 'Escape') { event.preventDefault(); closeFigureViewer(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); showFigure(figureIndex - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); showFigure(figureIndex + 1); }
    if (event.key === 'Tab') {
      const items = [...figureViewer.querySelectorAll('button:not([hidden])')];
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    return;
  }
  if (event.key === 'Escape' && masterMenu && !masterMenu.hidden) closeMenu();
  if (event.key === 'Tab' && activePanel?.getAttribute('aria-modal') === 'true') {
    const items = [...activePanel.querySelectorAll('button, a[href], input, textarea, select, [tabindex="0"]')];
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  if (event.key === 'Escape' && activePanel) {
    event.preventDefault();
    closePanel();
  }
});

document.addEventListener('click', event => {
  if (figureViewer && !figureViewer.hidden) return;
  if (masterMenu && !masterMenu.hidden && !masterMenu.contains(event.target)) closeMenu();
  if (activePanel && !activePanel.contains(event.target) && !event.target.closest('.topic-hover')) closePanel(false);
});

updateScene();
