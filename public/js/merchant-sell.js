(function () {
  const input = document.getElementById('productSearch');
  const cards = Array.from(document.querySelectorAll('[data-product-card]'));
  const empty = document.getElementById('productSearchEmpty');
  if (!input) return;

  function norm(v) { return String(v || '').toLowerCase().trim(); }
  function matches(card, q) {
    if (!q) return true;
    return card.dataset.name.includes(q) || card.dataset.id.includes(q);
  }
  function filter() {
    const q = norm(input.value);
    let visible = 0;
    cards.forEach((card) => {
      const ok = matches(card, q);
      card.style.display = ok ? '' : 'none';
      if (ok) visible++;
    });
    if (empty) empty.classList.toggle('hidden', visible !== 0);
  }
  input.addEventListener('input', filter);
})();
