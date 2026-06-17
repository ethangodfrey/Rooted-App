import { useState } from 'react';

import { combineDateTime, toDateInput, toTimeInput } from '@/lib/event-datetime';
import type { Event, EventStatus, VisibilityStatus } from '@/types/database';
import '@/components/ui/ui.css';

export interface EventFormValues {
  name: string;
  description: string | null;
  organizer_name: string | null;
  start_datetime: string;
  end_datetime: string;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
  event_status: EventStatus;
  visibility_status: VisibilityStatus;
  parking_info: string | null;
  admission_info: string | null;
}

interface EventFormProps {
  initial?: Partial<Event>;
  submitLabel: string;
  onSubmit: (values: EventFormValues) => Promise<void> | void;
  loading?: boolean;
}

const EVENT_STATUSES: EventStatus[] = ['upcoming', 'live', 'completed', 'cancelled'];
const VISIBILITY_STATUSES: VisibilityStatus[] = ['draft', 'public'];

function defaultStart(): { date: string; time: string } {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(10, 0, 0, 0);
  return { date: toDateInput(d.toISOString()), time: toTimeInput(d.toISOString()) };
}

function defaultEnd(startDate: string, startTime: string): { date: string; time: string } {
  const startIso = combineDateTime(startDate, startTime);
  if (!startIso) return defaultStart();
  const d = new Date(startIso);
  d.setHours(d.getHours() + 6);
  return { date: toDateInput(d.toISOString()), time: toTimeInput(d.toISOString()) };
}

export function EventForm({ initial, submitLabel, onSubmit, loading = false }: EventFormProps) {
  const startDefaults = initial?.start_datetime
    ? { date: toDateInput(initial.start_datetime), time: toTimeInput(initial.start_datetime) }
    : defaultStart();
  const endDefaults = initial?.end_datetime
    ? { date: toDateInput(initial.end_datetime), time: toTimeInput(initial.end_datetime) }
    : defaultEnd(startDefaults.date, startDefaults.time);

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [organizerName, setOrganizerName] = useState(initial?.organizer_name ?? '');
  const [startDate, setStartDate] = useState(startDefaults.date);
  const [startTime, setStartTime] = useState(startDefaults.time);
  const [endDate, setEndDate] = useState(endDefaults.date);
  const [endTime, setEndTime] = useState(endDefaults.time);
  const [address, setAddress] = useState(initial?.address ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [state, setState] = useState(initial?.state ?? '');
  const [latitude, setLatitude] = useState(
    initial?.latitude != null ? String(initial.latitude) : '',
  );
  const [longitude, setLongitude] = useState(
    initial?.longitude != null ? String(initial.longitude) : '',
  );
  const [eventStatus, setEventStatus] = useState<EventStatus>(initial?.event_status ?? 'upcoming');
  const [visibilityStatus, setVisibilityStatus] = useState<VisibilityStatus>(
    initial?.visibility_status ?? 'draft',
  );
  const [parkingInfo, setParkingInfo] = useState(initial?.parking_info ?? '');
  const [admissionInfo, setAdmissionInfo] = useState(initial?.admission_info ?? '');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Event name is required.');
      return;
    }

    const startIso = combineDateTime(startDate, startTime);
    const endIso = combineDateTime(endDate, endTime);
    if (!startIso || !endIso) {
      setError('Enter valid start and end date/time values.');
      return;
    }
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setError('End time must be after start time.');
      return;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError('Latitude and longitude must be valid numbers.');
      return;
    }

    await onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      organizer_name: organizerName.trim() || null,
      start_datetime: startIso,
      end_datetime: endIso,
      address: address.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      latitude: lat,
      longitude: lng,
      event_status: eventStatus,
      visibility_status: visibilityStatus,
      parking_info: parkingInfo.trim() || null,
      admission_info: admissionInfo.trim() || null,
    });
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <div className="app-input-group">
        <label>Name</label>
        <input className="app-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="app-input-group">
        <label>Description</label>
        <textarea className="app-textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="app-input-group">
        <label>Organizer</label>
        <input className="app-input" value={organizerName} onChange={(e) => setOrganizerName(e.target.value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="app-input-group">
          <label>Start date</label>
          <input className="app-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="app-input-group">
          <label>Start time</label>
          <input className="app-input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div className="app-input-group">
          <label>End date</label>
          <input className="app-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="app-input-group">
          <label>End time</label>
          <input className="app-input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>

      <div className="app-input-group">
        <label>Address</label>
        <input className="app-input" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="app-input-group">
          <label>City</label>
          <input className="app-input" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="app-input-group">
          <label>State</label>
          <input className="app-input" value={state} onChange={(e) => setState(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="app-input-group">
          <label>Latitude</label>
          <input className="app-input" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
        </div>
        <div className="app-input-group">
          <label>Longitude</label>
          <input className="app-input" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
        </div>
      </div>

      <div className="app-input-group">
        <label>Status</label>
        <select className="app-input" value={eventStatus} onChange={(e) => setEventStatus(e.target.value as EventStatus)}>
          {EVENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="app-input-group">
        <label>Visibility</label>
        <select className="app-input" value={visibilityStatus} onChange={(e) => setVisibilityStatus(e.target.value as VisibilityStatus)}>
          {VISIBILITY_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="app-input-group">
        <label>Parking info</label>
        <textarea className="app-textarea" value={parkingInfo} onChange={(e) => setParkingInfo(e.target.value)} />
      </div>
      <div className="app-input-group">
        <label>Admission info</label>
        <textarea className="app-textarea" value={admissionInfo} onChange={(e) => setAdmissionInfo(e.target.value)} />
      </div>

      {error ? <p className="app-error">{error}</p> : null}

      <button type="submit" className="app-btn app-btn--primary" disabled={loading}>
        {loading ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
