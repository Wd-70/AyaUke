export default function ThemeScript() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var savedTheme = localStorage.getItem('theme');
                var systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                var theme = savedTheme || systemTheme;
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            })();
          `,
        }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            // 테마 전환: 누른 위치에서 새 테마가 원으로 퍼진다(View Transitions). 미지원·동작 줄이기면 즉시 전환.
            window.__toggleTheme = function(x, y) {
              var root = document.documentElement;
              var flip = function() {
                var dark = root.classList.toggle('dark');
                try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (err) {}
              };
              var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              if (!document.startViewTransition || reduce) { flip(); return; }
              if (x == null) { x = window.innerWidth / 2; y = 0; }
              var r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
              root.dataset.themeVt = '';
              var t = document.startViewTransition(flip);
              t.ready.then(function() {
                root.animate(
                  { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] },
                  { duration: 480, easing: 'cubic-bezier(0.2, 0, 0, 1)', pseudoElement: '::view-transition-new(root)' }
                );
              }).catch(function() {});
              t.finished.finally(function() { delete root.dataset.themeVt; });
            };
            document.addEventListener('DOMContentLoaded', function() {
              document.addEventListener('click', function(e) {
                var btn = e.target.closest('[data-theme-toggle]');
                if (btn) {
                  var b = btn.getBoundingClientRect();
                  window.__toggleTheme(b.left + b.width / 2, b.top + b.height / 2);
                }
              });
            });
          `,
        }}
      />
    </>
  );
}