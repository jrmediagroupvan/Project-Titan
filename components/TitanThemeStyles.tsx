export default function TitanThemeStyles() {
  return (
    <style>{`
      :root, html[data-theme="dark"] {
        --titan-bg:#050d18;--titan-bg-alt:#09192d;--titan-surface:rgba(10,25,44,.95);--titan-surface-elevated:rgba(18,40,66,.97);--titan-sidebar:#061426;--titan-text:#f4f8ff;--titan-muted:#9cb1c8;--titan-border:rgba(111,164,214,.23);--titan-accent:#31b7ff;--titan-accent-strong:#0799ef;--titan-accent-soft:rgba(49,183,255,.13);--titan-success:#45d79a;--titan-warning:#f7bf56;--titan-danger:#ff6d7a;--titan-shadow-sm:0 8px 20px rgba(0,0,0,.16);--titan-shadow-md:0 16px 38px rgba(0,0,0,.25);--titan-shadow-lg:0 28px 80px rgba(0,0,0,.4);
      }
      html[data-theme="light"] {
        --titan-bg:#ffffff;--titan-bg-alt:#f7f9fc;--titan-surface:#ffffff;--titan-surface-elevated:#ffffff;--titan-sidebar:#ffffff;--titan-text:#102238;--titan-muted:#5b7086;--titan-border:rgba(49,94,139,.18);--titan-accent:#087cc1;--titan-accent-strong:#05649c;--titan-accent-soft:rgba(8,124,193,.11);--titan-success:#16875f;--titan-warning:#a86908;--titan-danger:#c83e4e;--titan-shadow-sm:0 8px 20px rgba(38,70,104,.08);--titan-shadow-md:0 16px 38px rgba(38,70,104,.12);--titan-shadow-lg:0 28px 80px rgba(38,70,104,.18);
      }
      html,body{background:var(--titan-bg);color:var(--titan-text)} html[data-theme="dark"] body{background:radial-gradient(circle at 82% -10%,var(--titan-accent-soft),transparent 34rem),linear-gradient(145deg,var(--titan-bg),var(--titan-bg-alt))} html[data-theme="light"] body{background:#fff}
      body{min-height:100vh;transition:background .18s ease,color .18s ease}
      .layout,.contentColumn,.main,.publicLayout,.publicMain{background:transparent;color:var(--titan-text)}
      .sidebar{background:linear-gradient(180deg,var(--titan-sidebar),color-mix(in srgb,var(--titan-sidebar) 88%,black));border-color:var(--titan-border)}
      .card,.record,.tableWrap,input,select,textarea{background-color:var(--titan-surface);color:var(--titan-text);border-color:var(--titan-border)}
      .card{box-shadow:var(--titan-shadow-sm)}
      .muted,.tag,.navGroupLabel,.siteFooter{color:var(--titan-muted)}
      .nav a:hover,.nav a[aria-current="page"]{background:var(--titan-accent-soft);color:var(--titan-text)}
      input:focus,textarea:focus,select:focus{border-color:var(--titan-accent);outline:3px solid var(--titan-accent-soft)}
      .button{background:linear-gradient(135deg,var(--titan-accent),var(--titan-accent-strong));color:white;box-shadow:0 8px 24px var(--titan-accent-soft)}
      .secondary{background:var(--titan-surface-elevated);color:var(--titan-text);border:1px solid var(--titan-border)}
      .appTopbar{background:color-mix(in srgb,var(--titan-surface) 92%,transparent);border-color:var(--titan-border);box-shadow:var(--titan-shadow-sm);backdrop-filter:blur(18px)}
      ::selection{color:white;background:var(--titan-accent-strong)}
      *{scrollbar-color:var(--titan-accent-strong) var(--titan-bg-alt)}
    `}</style>
  );
}
