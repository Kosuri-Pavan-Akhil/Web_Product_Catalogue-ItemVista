import { useState, type FormEvent } from 'react';

const guestKey = 'itemvista.guest';

export interface GuestProfile {
  name: string;
  email: string;
  remember: boolean;
}

function readProfile(storage: Storage, remember: boolean): GuestProfile | null {
  try {
    const data = JSON.parse(storage.getItem(guestKey) ?? 'null');
    if (typeof data?.name === 'string' && typeof data.email === 'string') {
      return { name: data.name, email: data.email, remember };
    }
  } catch {
    // An unreadable profile should not prevent browsing or sending an enquiry.
  }
  return null;
}

export function readGuestProfile(): GuestProfile | null {
  try {
    return readProfile(sessionStorage, false) ?? readProfile(localStorage, true);
  } catch {
    return null;
  }
}

function saveGuestProfile(profile: GuestProfile) {
  const selectedStorage = profile.remember ? localStorage : sessionStorage;
  const otherStorage = profile.remember ? sessionStorage : localStorage;
  selectedStorage.setItem(guestKey, JSON.stringify({ name: profile.name, email: profile.email }));
  otherStorage.removeItem(guestKey);
}

export function GuestProfilePage({ profile, onChange }: {
  profile: GuestProfile | null;
  onChange: (profile: GuestProfile | null) => void;
}) {
  const [error, setError] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    if (!name || name.length > 120) {
      setError('Enter a name of up to 120 characters.');
      return;
    }
    if (email.length > 254 || !/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }

    const next = { name, email, remember: form.has('remember') };
    try {
      saveGuestProfile(next);
      setError('');
      onChange(next);
    } catch {
      setError('This browser couldn’t save your guest details.');
    }
  }

  function logOut() {
    try {
      sessionStorage.removeItem(guestKey);
      localStorage.removeItem(guestKey);
      setError('');
      onChange(null);
    } catch {
      setError('This browser couldn’t clear your guest details.');
    }
  }

  return (
    <div className="guest-page">
      <h1>{profile ? 'Guest profile' : 'Continue as guest'}</h1>
      <div className="guest-panel panel">
        {profile ? (
          <>
            <dl className="guest-contact">
              <dt>Name</dt><dd>{profile.name}</dd>
              <dt>Email</dt><dd>{profile.email}</dd>
            </dl>
            <button type="button" className="button outline" onClick={logOut}>Log out</button>
          </>
        ) : (
          <>
            <p>Save your contact details to prefill enquiries. They stay in this tab unless you choose to remember them on this device.</p>
            <form className="enquiry-form" onSubmit={handleSubmit}>
              <label>Name<input name="name" autoComplete="name" maxLength={120} required /></label>
              <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
              <label className="guest-remember">
                <input type="checkbox" name="remember" />
                Remember me on this device
              </label>
              <button type="submit">Continue as guest</button>
            </form>
          </>
        )}
        {error && <p className="guest-feedback" role="alert">{error}</p>}
      </div>
    </div>
  );
}
