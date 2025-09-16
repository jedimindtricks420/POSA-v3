function increase(id) {
    const input = document.getElementById('qty-' + id);
    input.value = parseInt(input.value || '0') + 1;
  }
  
  function decrease(id) {
    const input = document.getElementById('qty-' + id);
    if (parseInt(input.value || '0') > 0) {
      input.value = parseInt(input.value) - 1;
    }
  }
  