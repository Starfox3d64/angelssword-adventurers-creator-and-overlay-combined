
(function () {
  if (window.__ASNotes) return;
  var KEY = 'as_session_notes';
  function ensure() {
    if (document.getElementById('asNotesFab')) return;
    var style = document.createElement('style');
    style.textContent = [
      '#asNotesFab{position:fixed;right:16px;bottom:72px;z-index:99980;width:44px;height:44px;border-radius:50%;',
      'background:var(--bg-panel,var(--as-panel,#0a0a0a));color:var(--accent-gold,var(--as-accent,#c9a227));',
      'border:1px solid var(--border-gold,var(--as-border,rgba(201,162,39,.35)));cursor:pointer;font-size:1.1rem;',
      'box-shadow:0 6px 20px rgba(0,0,0,.45)}',
      '#asNotesFab:hover{background:var(--accent-red,var(--as-accent-2,#8b2942));color:#fff}',
      '#asNotesPanel{position:fixed;right:16px;bottom:124px;z-index:99981;width:min(320px,92vw);',
      'background:var(--bg-panel,var(--as-panel,#0a0a0a));color:var(--text,var(--as-text,#e6dcc8));',
      'border:1px solid var(--border-gold,var(--as-border,rgba(201,162,39,.35)));border-radius:12px;padding:12px;',
      'box-shadow:0 12px 40px rgba(0,0,0,.5);display:none}',
      '#asNotesPanel.open{display:block}',
      '#asNotesPanel h3{margin:0 0 8px;font-size:.9rem;color:var(--accent-gold,var(--as-accent,#c9a227));display:flex;justify-content:space-between;align-items:center}',
      '#asNotesPanel textarea{width:100%;min-height:140px;box-sizing:border-box;background:var(--bg-input,var(--as-bg,#070707));',
      'color:var(--text,var(--as-text,#e6dcc8));border:1px solid var(--border-gold,var(--as-border,rgba(201,162,39,.25)));',
      'border-radius:8px;padding:8px;font:inherit;resize:vertical}',
      '#asNotesPanel .as-notes-close{background:transparent;border:none;color:var(--text-muted,var(--as-muted,#9a8b6a));cursor:pointer;font-size:1rem}'
    ].join('');
    document.head.appendChild(style);

    var panel = document.createElement('div');
    panel.id = 'asNotesPanel';
    panel.innerHTML = '<h3>📌 Session Notes <button type="button" class="as-notes-close" title="Close">✕</button></h3>' +
      '<textarea id="asNotesBody" placeholder="Stream ideas, checklist, cues..."></textarea>';
    document.body.appendChild(panel);

    var fab = document.createElement('button');
    fab.id = 'asNotesFab';
    fab.type = 'button';
    fab.title = 'Notes';
    fab.textContent = '📌';
    document.body.appendChild(fab);

    var body = document.getElementById('asNotesBody');
    try { body.value = localStorage.getItem(KEY) || ''; } catch (e) {}
    body.addEventListener('input', function () {
      try { localStorage.setItem(KEY, body.value); } catch (e) {}
    });
    function toggle() { panel.classList.toggle('open'); }
    fab.addEventListener('click', toggle);
    panel.querySelector('.as-notes-close').addEventListener('click', function () { panel.classList.remove('open'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure);
  else ensure();
  window.__ASNotes = { open: function () { ensure(); document.getElementById('asNotesPanel').classList.add('open'); } };
})();
