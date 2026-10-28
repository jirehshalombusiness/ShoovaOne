(function () {
  try {
    var preference = localStorage.getItem('shoova_theme') || 'system';
    var dark =
      preference === 'dark' ||
      (preference === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document.documentElement.style.backgroundColor = dark
      ? '#0a100e'
      : '#f6f7f8';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0a100e' : '#176b4d');
  } catch (error) {}
})();
