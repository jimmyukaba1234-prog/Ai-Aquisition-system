import { useEffect, useState } from 'react';
import { useStore } from '../store.jsx';
import { Button, Field, Modal } from '../components/ui.jsx';
import { lastSunday, today, fullName } from '../lib/journey.js';
import { normalizePhone, displayPhone, cls } from '../lib/format.js';

// Options mirror the printed Guest Information Card.
export const CARD = {
  ages: ['15-20', '21-25', '26-30', '31-35', '36-40', '41-45', '46-50', '50 & above'],
  status: ['Married', 'Single', 'Divorced/Separated/Widowed', 'Prefer not to say'],
  sectors: ['Unemployed', 'Self-employed', 'Education', 'NGO', 'Government Worker', 'Career Professional', 'Business Owner', 'Student'],
  interests: ['Technology', 'Fashion and Lifestyle', 'Public Sector', 'Private Sector', 'Family Life', 'Media', 'Others'],
  heard: ['A friend/ Family', 'YouTube', 'Instagram/ Facebook/ Twitter', 'Billboard/ Lampost', 'Passing by our venue', 'TV/ Others'],
};

const blank = () => ({
  first_visit: lastSunday(), surname: '', other_names: '', gender: '', age_range: '', marital_status: '', phone: '', email: '',
  town: '', lga: '', area: '', bus_stop: '', house_no: '', street: '', sector: '', occupation: '', interests: [], would_join: '',
  prayer_request: '', needs: '', heard_via: [], assigned_to: '',
});

export default function GuestForm({ open, guest, onClose, onSaved }) {
  const { data, addGuests, updateGuest } = useStore();
  const [f, setF] = useState(blank());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setErr('');
    setF(guest ? { ...blank(), ...Object.fromEntries(Object.entries(guest).map(([k, v]) => [k, v ?? (Array.isArray(blank()[k]) ? [] : '')])), phone: displayPhone(guest.phone) } : blank());
  }, [open, guest]);

  if (!data) return null;
  const team = data.profiles.filter((p) => ['admin', 'followup', 'acquisition'].includes(p.role) && p.active !== false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (k, v) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });
  const phone = normalizePhone(f.phone);
  const dup = !guest && phone && data.guests.find((g) => g.phone === phone);

  async function save(e) {
    e?.preventDefault();
    if (!f.surname.trim()) return setErr('Surname is required.');
    if (f.phone && !phone) return setErr('That phone number doesn’t look right.');
    setBusy(true); setErr('');
    const row = {};
    Object.keys(blank()).forEach((k) => { const v = f[k]; row[k] = Array.isArray(v) ? v : (typeof v === 'string' ? v.trim() : v) || null; });
    row.phone = phone || null;
    row.email = row.email ? row.email.toLowerCase() : null;
    try {
      if (guest) { const g = await updateGuest(guest.id, row, 'Guest updated'); onSaved?.(g); }
      else { const [g] = await addGuests([{ ...row, last_visit: row.first_visit, created_by: data.me.id }], 'Guest added'); onSaved?.(g); }
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }

  return (
    <Modal open={open} onClose={onClose} title={guest ? `Edit ${fullName(guest)}` : 'Add a guest'} width={860}
      footer={<><span className="err">{err}</span><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : guest ? 'Save changes' : 'Add guest'}</Button></>}>
      <form className="gform" onSubmit={save}>
        <p className="gform-sec">Visit</p>
        <Field label="Date of first visit" required><input type="date" value={f.first_visit} max={today()} onChange={set('first_visit')} required /></Field>
        <Field label="Assigned for follow-up"><select value={f.assigned_to || ''} onChange={set('assigned_to')}><option value="">Not assigned</option>{team.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</select></Field>

        <p className="gform-sec">Personal</p>
        <Field label="Surname" required><input value={f.surname} onChange={set('surname')} required /></Field>
        <Field label="Other names"><input value={f.other_names} onChange={set('other_names')} /></Field>
        <Field label="Gender"><Pills options={['Male', 'Female']} value={f.gender} onChange={(v) => setF({ ...f, gender: v })} /></Field>
        <Field label="Age"><select value={f.age_range || ''} onChange={set('age_range')}><option value="">—</option>{CARD.ages.map((a) => <option key={a}>{a}</option>)}</select></Field>
        <Field label="Status" full><Pills options={CARD.status} value={f.marital_status} onChange={(v) => setF({ ...f, marital_status: v })} /></Field>

        <p className="gform-sec">Contact</p>
        <Field label="Phone no" hint={dup ? `Already in the system: ${fullName(dup)} (first visit ${dup.first_visit})` : phone ? `Saved as ${phone}` : ''}><input value={f.phone} onChange={set('phone')} inputMode="tel" placeholder="0803 000 0000" /></Field>
        <Field label="Email"><input type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Town"><input value={f.town} onChange={set('town')} /></Field>
        <Field label="Local government area"><input value={f.lga} onChange={set('lga')} /></Field>
        <Field label="Area"><input value={f.area} onChange={set('area')} /></Field>
        <Field label="Nearest bus stop"><input value={f.bus_stop} onChange={set('bus_stop')} /></Field>
        <Field label="House no."><input value={f.house_no} onChange={set('house_no')} /></Field>
        <Field label="Street / estate"><input value={f.street} onChange={set('street')} /></Field>

        <p className="gform-sec">Work &amp; interests</p>
        <Field label="Current sector"><select value={f.sector || ''} onChange={set('sector')}><option value="">—</option>{CARD.sectors.map((a) => <option key={a}>{a}</option>)}</select></Field>
        <Field label="Occupation"><input value={f.occupation} onChange={set('occupation')} /></Field>
        <Field label="Interests" full><Pills multi options={CARD.interests} value={f.interests} onChange={(v) => toggle('interests', v)} /></Field>

        <p className="gform-sec">Their response</p>
        <Field label="Would you consider joining The Elevation Church?" full><Pills options={['Yes', 'No', 'Maybe']} value={f.would_join} onChange={(v) => setF({ ...f, would_join: v })} /></Field>
        <Field label="How did you get to know about our church?" full><Pills multi options={CARD.heard} value={f.heard_via} onChange={(v) => toggle('heard_via', v)} /></Field>
        <Field label="What are your needs and aspirations?" full><textarea rows={2} value={f.needs} onChange={set('needs')} /></Field>
        <Field label="Is there something you would like us to pray about?" full><textarea rows={2} value={f.prayer_request} onChange={set('prayer_request')} /></Field>
      </form>
    </Modal>
  );
}

function Pills({ options, value, onChange, multi }) {
  return (
    <div className="pills">
      {options.map((o) => {
        const on = multi ? value.includes(o) : value === o;
        return <button type="button" key={o} className={cls('pill', on && 'on')} aria-pressed={on} onClick={() => onChange(multi ? o : on ? '' : o)}>{o}</button>;
      })}
    </div>
  );
}
