import { STORAGE_KEY, validateBackup, addWorkouts } from './core.js';
import { templatesFromBackup } from './template-transfer.js';

// Runs only inside the preview. No production storage keys are read or written.
const host = document.querySelector('#main');
const UI_ID = 'template-transfer-panel';
const FILE_LIMIT = 8_000_000;
let candidates = null;

function button(label, onClick, secondary = false) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = secondary ? 'btn secondary small-btn' : 'btn small-btn';
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}

function feedback(panel, message, error = false) {
  const notice = panel.querySelector('[data-transfer-status]');
  notice.textContent = message;
  notice.className = error ? 'notice warn' : 'hint';
}

function mount() {
  if (!location.pathname.includes('/preview-v101/')) return;
  const grid = host?.querySelector('.codex-library-grid');
  if (!grid || document.getElementById(UI_ID)) return;
  candidates = null;
  const panel = document.createElement('section');
  panel.id = UI_ID;
  panel.className = 'card stack';
  const heading = document.createElement('h2');
  heading.textContent = 'Copy templates from your live FitnessPilot';
  const intro = document.createElement('p');
  intro.className = 'subtle small';
  intro.textContent = 'In the live app, use Tools → Download full backup (.json). Select that file here. This test imports template definitions only: no workout logs, measurements, symptoms, schedule or reminders.';
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = '.json,application/json';
  file.setAttribute('aria-label', 'Choose production FitnessPilot backup');
  const status = document.createElement('p');
  status.dataset.transferStatus = '';
  status.className = 'hint';
  status.textContent = 'Your source backup stays unchanged. Nothing is imported until you confirm.';
  const names = document.createElement('ul');
  names.className = 'preview-list';
  const actions = document.createElement('div');
  actions.className = 'quick-actions';
  panel.append(heading, intro, file, status, names, actions);
  grid.insertAdjacentElement('afterend', panel);

  file.addEventListener('change', async () => {
    candidates = null;
    names.replaceChildren();
    actions.replaceChildren();
    const chosen = file.files?.[0];
    if (!chosen) return;
    try {
      if (chosen.size > FILE_LIMIT || !/\.json$/i.test(chosen.name)) {
        throw Error('Choose a .json FitnessPilot backup smaller than 8 MB.');
      }
      candidates = templatesFromBackup(JSON.parse(await chosen.text()));
      feedback(panel, `Review ${candidates.length} template(s). Lower-body workouts require PT review. Only template definitions will be added.`);
      for (const template of candidates) {
        const row = document.createElement('li');
        row.textContent = `${template.name} · ${template.exercises.length} exercises${template.requiresClinicalReview ? ' · [PT Review]' : ''}`;
        names.append(row);
      }
      actions.append(
        button('Add templates to test library', () => {
          try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) {
              // A brand-new preview without any data is safe to initialise.
              const initial = {version:1,templates:[],assignments:{},logs:[],metrics:[],
                reminder:{hour:18,minute:30,lead:0}};
              localStorage.setItem(STORAGE_KEY, JSON.stringify(validateBackup(initial)));
            }
            const current = validateBackup(JSON.parse(localStorage.getItem(STORAGE_KEY)));
            const result = addWorkouts(current, candidates, false);
            if (!result.added) {
              feedback(panel, `All ${result.skipped} template(s) already exist. No data changed.`);
              return;
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(validateBackup(result.state)));
            candidates = null;
            location.reload();
          } catch (error) {
            feedback(panel, `No templates imported: ${error.message}`, true);
          }
        }),
        button('Cancel', () => {
          candidates = null;
          file.value = '';
          names.replaceChildren();
          actions.replaceChildren();
          feedback(panel, 'Import canceled. No data changed.');
        }, true)
      );
    } catch (error) {
      feedback(panel, `Backup rejected: ${error.message}`, true);
    }
  });
}

if (host) {
  mount();
  new MutationObserver(mount).observe(host, {childList:true});
}
