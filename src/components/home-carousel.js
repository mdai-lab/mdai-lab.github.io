(() => {
  const carousel = document.querySelector('[data-home-carousel]');
  if (!carousel) return;
  const slides = [...carousel.querySelectorAll('.home-slide')];
  const controls = [...document.querySelectorAll('.home-gallery-dot')];
  const previous = carousel.querySelector('.home-carousel-prev');
  const next = carousel.querySelector('.home-carousel-next');
  if (slides.length < 2) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const interval = Number(carousel.dataset.interval) || 6500;
  let current = 0;
  let timer;
  let paused = false;

  function show(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, position) => {
      const active = position === current;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
      slide.querySelector('.home-slide-caption')?.setAttribute('tabindex', active ? '0' : '-1');
    });
    controls.forEach((control, position) => {
      const active = position === current;
      control.classList.toggle('is-active', active);
      control.setAttribute('aria-pressed', String(active));
    });
  }
  function stop() { clearInterval(timer); timer = undefined; }
  function start() {
    stop();
    if (!paused && !reducedMotion.matches && !document.hidden) timer = setInterval(() => show(current + 1), interval);
  }
  controls.forEach(control => control.addEventListener('click', () => {
    show(Number(control.dataset.slide));
    start();
  }));
  previous?.addEventListener('click', () => { show(current - 1); start(); });
  next?.addEventListener('click', () => { show(current + 1); start(); });
  carousel.addEventListener('pointerenter', () => { paused = true; stop(); });
  carousel.addEventListener('pointerleave', () => { paused = false; start(); });
  carousel.addEventListener('focusin', () => { paused = true; stop(); });
  carousel.addEventListener('focusout', event => {
    if (!carousel.contains(event.relatedTarget)) { paused = false; start(); }
  });
  document.addEventListener('visibilitychange', start);
  reducedMotion.addEventListener('change', start);
  show(0);
  start();
})();
