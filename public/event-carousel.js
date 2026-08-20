(() => {
  const AUTOPLAY_MS = 5000;
  const EVENTS = [
    {
      title: 'เทศบาลนครเชียงราย',
      subtitle: 'เมืองน่าอยู่ สิ่งแวดล้อมดี ชีวิตมีคุณภาพ',
      image: '/watch_tower.jpg',
      alt: 'หอนาฬิกาเชียงรายยามเย็น'
    },
    {
      title: 'กิจกรรมเทศบาลประจำสัปดาห์',
      subtitle: 'ติดตามกิจกรรมและบริการสำหรับประชาชนในเขตเทศบาล',
      image: 'https://images.unsplash.com/photo-1472653431158-6364773b2a56?auto=format&fit=crop&w=1200&q=85',
      alt: 'บรรยากาศงานกิจกรรมชุมชน'
    },
    {
      title: 'ข่าวสารและกิจกรรมชุมชน',
      subtitle: 'ร่วมสร้างเมืองเชียงรายให้น่าอยู่ไปด้วยกัน',
      image: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1200&q=85',
      alt: 'บรรยากาศกิจกรรมบนเวที'
    }
  ];

  let observer: MutationObserver | null = null;

  function renderCarousel(card) {
    if (!card || card.dataset.carouselReady === 'true') return;
    card.dataset.carouselReady = 'true';
    card.classList.add('event-carousel');

    card.innerHTML = `
      <div class="event-carousel-track" aria-live="polite">
        ${EVENTS.map((event, index) => `
          <article class="event-slide${index === 0 ? ' is-active' : ''}" data-slide="${index}">
            <img src="${event.image}" alt="${event.alt}" loading="${index === 0 ? 'eager' : 'lazy'}" />
            <div class="hero-overlay">
              <span>${event.title}</span>
              <small>${event.subtitle}</small>
            </div>
          </article>
        `).join('')}
      </div>
      <div class="event-carousel-dots" role="tablist" aria-label="เลือกข่าวเด่น">
        ${EVENTS.map((event, index) => `
          <button type="button" class="event-carousel-dot${index === 0 ? ' is-active' : ''}" data-slide-to="${index}" role="tab" aria-selected="${index === 0}" aria-label="แสดง ${event.title}"></button>
        `).join('')}
      </div>
    `;

    const slides = Array.from(card.querySelectorAll('.event-slide'));
    const dots = Array.from(card.querySelectorAll('.event-carousel-dot'));
    let index = 0;
    let timer = null;
    let startX = 0;
    let startY = 0;
    let isDragging = false;

    const show = (nextIndex, restart = true) => {
      index = (nextIndex + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => slide.classList.toggle('is-active', slideIndex === index));
      dots.forEach((dot, dotIndex) => {
        dot.classList.toggle('is-active', dotIndex === index);
        dot.setAttribute('aria-selected', String(dotIndex === index));
      });
      if (restart) startTimer();
    };

    const stopTimer = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    function startTimer() {
      stopTimer();
      timer = window.setInterval(() => show(index + 1, false), AUTOPLAY_MS);
    }

    dots.forEach(dot => dot.addEventListener('click', () => {
      show(Number(dot.dataset.slideTo) || 0);
    }));

    card.addEventListener('pointerdown', event => {
      isDragging = true;
      startX = event.clientX;
      startY = event.clientY;
      stopTimer();
      card.setPointerCapture?.(event.pointerId);
    });

    card.addEventListener('pointerup', event => {
      if (!isDragging) return;
      isDragging = false;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
        show(index + (dx < 0 ? 1 : -1));
      } else {
        startTimer();
      }
    });

    card.addEventListener('pointercancel', () => {
      isDragging = false;
      startTimer();
    });

    card.addEventListener('mouseenter', stopTimer);
    card.addEventListener('mouseleave', startTimer);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopTimer();
      else if (card.isConnected) startTimer();
    });

    startTimer();
  }

  function scan() {
    document.querySelectorAll('.hero-card:not([data-carousel-ready="true"])').forEach(renderCarousel);
  }

  observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true });
  scan();
})();
