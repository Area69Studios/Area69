/* The site is static, so submissions go to a third-party form endpoint.
   Web3Forms takes a key tied to the address you want the mail delivered to;
   get one at https://web3forms.com (an email, no account) and paste it below.
   Until it is set the form says so rather than claiming a message was sent. */
const ACCESS_KEY = '';

const ENDPOINT = 'https://api.web3forms.com/submit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function setNote(note, text, kind) {
  note.textContent = text;
  note.dataset.state = kind; // idle | error | ok | sending
}

function markInvalid(field, invalid) {
  field.setAttribute('aria-invalid', String(invalid));
  field.closest('.field')?.classList.toggle('is-invalid', invalid);
}

function validate(fields) {
  for (const f of Object.values(fields)) markInvalid(f, false);

  if (!fields.name.value.trim()) {
    markInvalid(fields.name, true);
    return { ok: false, msg: 'Escribe tu nombre.', focus: fields.name };
  }
  if (!EMAIL_RE.test(fields.email.value.trim())) {
    markInvalid(fields.email, true);
    return { ok: false, msg: 'Ese correo no parece válido.', focus: fields.email };
  }
  if (fields.message.value.trim().length < 10) {
    markInvalid(fields.message, true);
    return { ok: false, msg: 'Cuéntanos un poco más (mínimo 10 caracteres).', focus: fields.message };
  }
  return { ok: true };
}

export function initContactForm() {
  const form = document.getElementById('contactForm');
  const note = document.getElementById('formNote');
  if (!form || !note) return;

  const button = form.querySelector('button[type="submit"]');
  const buttonLabel = button.textContent;
  const fields = {
    name: form.querySelector('#name'),
    email: form.querySelector('#email'),
    message: form.querySelector('#message'),
  };
  const honeypot = form.querySelector('#website');

  // bots fill every field they find, including the one nobody can see
  const openedAt = Date.now();
  let sending = false;

  Object.values(fields).forEach((f) =>
    f.addEventListener('input', () => {
      if (f.getAttribute('aria-invalid') === 'true') markInvalid(f, false);
    })
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;

    // silently accept the bots rather than telling them what gave them away
    if (honeypot?.value || Date.now() - openedAt < 2500) {
      setNote(note, 'Señal recibida.', 'ok');
      form.reset();
      return;
    }

    const check = validate(fields);
    if (!check.ok) {
      setNote(note, check.msg, 'error');
      check.focus.focus();
      return;
    }

    if (!ACCESS_KEY) {
      setNote(note, 'El formulario aún no está conectado. Escríbenos por Instagram mientras tanto.', 'error');
      console.warn('[contacto] Falta ACCESS_KEY en src/lib/contact.js — el mensaje no se ha enviado.');
      return;
    }

    sending = true;
    button.disabled = true;
    button.textContent = 'Enviando…';
    setNote(note, 'Transmitiendo…', 'sending');

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          subject: `AREA69 — mensaje de ${fields.name.value.trim()}`,
          from_name: 'Web AREA69',
          name: fields.name.value.trim(),
          email: fields.email.value.trim(),
          message: fields.message.value.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setNote(note, 'Señal recibida. Te contactamos pronto.', 'ok');
        form.reset();
      } else {
        /* The service answers in English with things like "Invalid access
           key" — useful to whoever maintains the site, meaningless and
           alarming to whoever is trying to write to them. */
        console.error('[contacto] El servicio rechazó el envío:', data.message || res.status);
        setNote(note, 'No hemos podido enviarlo. Inténtalo de nuevo en un momento.', 'error');
      }
    } catch {
      setNote(note, 'Sin conexión con el servidor. Inténtalo de nuevo en un momento.', 'error');
    } finally {
      sending = false;
      button.disabled = false;
      button.textContent = buttonLabel;
    }
  });
}
