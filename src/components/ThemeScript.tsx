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
            document.addEventListener('DOMContentLoaded', function() {
              document.addEventListener('click', function(e) {
                if (e.target.closest('[data-theme-toggle]')) {
                  var isDark = document.documentElement.classList.contains('dark');
                  if (isDark) {
                    document.documentElement.classList.remove('dark');
                    localStorage.setItem('theme', 'light');
                  } else {
                    document.documentElement.classList.add('dark');
                    localStorage.setItem('theme', 'dark');
                  }
                }
              });
            });
          `,
        }}
      />
    </>
  );
}