/* The site is static, so submissions go through a form service. Paste
   EITHER of these into CONTACT_TARGET and it works out which it is:

     · a Web3Forms access key  — a long id like "a1b2c3d4-...", which they
       email you after you enter your address at web3forms.com
     · a Formspree endpoint    — the URL they give you for a form, like
       "https://formspree.io/f/abcdwxyz"

   Anything starting with http is treated as an endpoint, anything else as
   an access key. Until it is set the form says it is not connected rather
   than claiming a message was sent. */
const CONTACT_TARGET = '';

const WEB3FORMS = 'https://api.web3forms.com/submit';
const usesEndpoint = /^https?:\/\//i.test(CONTACT_TARGET);

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

    if (!CONTACT_TARGET) {
      setNote(note, 'El formulario aún no está conectado. Escríbenos por Instagram mientras tanto.', 'error');
      console.warn('[contacto] Falta CONTACT_TARGET en src/lib/contact.js — el mensaje no se ha enviado.');
      return;
    }

    sending = true;
    button.disabled = true;
    button.textContent = 'Enviando…';
    setNote(note, 'Transmitiendo…', 'sending');

    try {
      const name = fields.name.value.trim();
      const email = fields.email.value.trim();
      const message = fields.message.value.trim();

      const res = await fetch(usesEndpoint ? CONTACT_TARGET : WEB3FORMS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(
          usesEndpoint
            ? { name, email, message, _subject: `AREA69 — mensaje de ${name}` }
            : {
                access_key: CONTACT_TARGET,
                subject: `AREA69 — mensaje de ${name}`,
                from_name: 'Web AREA69',
                name,
                email,
                message,
              }
        ),
      });
      const data = await res.json().catch(() => ({}));

      /* The two services disagree on what success looks like: Web3Forms
         answers {success:true}, Formspree {ok:true} or an errors array. */
      const sent = res.ok && data.success !== false && !data.errors;
      if (sent) {
        setNote(note, 'Señal recibida. Te contactamos pronto.', 'ok');
        form.reset();
      } else {
        /* The service answers in English with things like "Invalid access
           key" — useful to whoever maintains the site, meaningless and
           alarming to whoever is trying to write to them. */
        console.error('[contacto] El servicio rechazó el envío:', data.message || data.errors?.[0]?.message || res.status);
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
