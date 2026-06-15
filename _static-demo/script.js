// ===== Atlas landing page interactions =====
// Runs after the HTML is parsed (script is at the end of <body>).

document.addEventListener("DOMContentLoaded", () => {
  /* ---- Sticky nav: add shadow/background once you scroll ---- */
  const nav = document.getElementById("nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 10);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---- Mobile menu toggle ---- */
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });
  // Close the menu when a link is tapped
  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      links.classList.remove("open");
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    })
  );

  /* ---- Scroll reveal animations ---- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("visible"));
  }

  /* ---- Animated stat counters ---- */
  const counters = document.querySelectorAll(".stat__num");
  const runCounter = (el) => {
    const target = Number(el.dataset.count) || 0;
    const suffix = el.dataset.suffix || "";
    const duration = 1400;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      const val = Math.floor(eased * target);
      el.textContent = val.toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString() + suffix;
    };
    requestAnimationFrame(step);
  };
  if ("IntersectionObserver" in window) {
    const statIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            runCounter(entry.target);
            statIO.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((c) => statIO.observe(c));
  } else {
    counters.forEach(runCounter);
  }

  /* ---- FAQ accordion ---- */
  document.querySelectorAll(".acc").forEach((item) => {
    const q = item.querySelector(".acc__q");
    const a = item.querySelector(".acc__a");
    q.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      // Close all, then open the clicked one if it wasn't already open
      document.querySelectorAll(".acc").forEach((other) => {
        other.classList.remove("open");
        other.querySelector(".acc__a").style.maxHeight = null;
      });
      if (!isOpen) {
        item.classList.add("open");
        a.style.maxHeight = a.scrollHeight + "px";
      }
    });
  });

  /* ---- Signup form (front-end validation only) ---- */
  const form = document.getElementById("signupForm");
  const email = document.getElementById("email");
  const msg = document.getElementById("formMsg");
  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = email.value.trim();
    if (!isValidEmail(value)) {
      msg.textContent = "Please enter a valid email address.";
      msg.className = "cta__msg err";
      email.focus();
      return;
    }
    msg.textContent = "🎉 Thanks! Check your inbox to finish signing up.";
    msg.className = "cta__msg ok";
    form.reset();
  });

  /* ---- Auto-update footer year ---- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
