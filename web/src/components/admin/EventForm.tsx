import { useState } from 'react';

import { FieldError } from '@/components/ui/FieldError';
import { combineDateTime, toDateInput, toTimeInput } from '@/lib/event-datetime';
import { isValidCoords } from '@/lib/geo';
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

type EventField =
  | 'name'
  | 'startDate'
  | 'startTime'
  | 'endDate'
  | 'endTime'
  | 'latitude'
  | 'longitude';

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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<EventField, string>>>({});

  function clearFieldError(field: EventField) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextFieldErrors: Partial<Record<EventField, string>> = {};

    if (!name.trim()) {
      nextFieldErrors.name = 'Event name is required.';
    }

    const startIso = combineDateTime(startDate, startTime);
    const endIso = combineDateTime(endDate, endTime);
    if (!startDate || !startIso) {
      nextFieldErrors.startDate = 'Enter a valid start date.';
    }
    if (!startTime || !startIso) {
      nextFieldErrors.startTime = 'Enter a valid start time.';
    }
    if (!endDate || !endIso) {
      nextFieldErrors.endDate = 'Enter a valid end date.';
    }
    if (!endTime || !endIso) {
      nextFieldErrors.endTime = 'Enter a valid end time.';
    }
    if (startIso && endIso && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      nextFieldErrors.endDate = 'End must be after the start.';
      nextFieldErrors.endTime = 'End must be after the start.';
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat)) {
      nextFieldErrors.latitude = 'Latitude must be a valid number.';
    }
    if (!Number.isFinite(lng)) {
      nextFieldErrors.longitude = 'Longitude must be a valid number.';
    }
    if (Number.isFinite(lat) && Number.isFinite(lng) && !isValidCoords({ latitude: lat, longitude: lng })) {
      nextFieldErrors.latitude = 'Latitude must be between -90 and 90.';
      nextFieldErrors.longitude = 'Longitude must be between -180 and 180.';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError(null);
      return;
    }

    setFieldErrors({});
    setError(null);

    await onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      organizer_name: organizerName.trim() || null,
      start_datetime: startIso!,
      end_datetime: endIso!,
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
        <input
          className={`app-input${fieldErrors.name ? ' app-input--invalid' : ''}`}
          value={name}
          aria-invalid={Boolean(fieldErrors.name)}
          onChange={(e) => {
            setName(e.target.value);
            clearFieldError('name');
          }}
        />
        <FieldError message={fieldErrors.name} />
      </div>
      <div className="app-input-group">
        <label>Description</label>
        <textarea className="app-textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="app-input-group">
        <label>Organizer</label>
        <input className="app-input" value={organizerName} onChange={(e) => setOrganizerName(e.target.value)} />
      </div>

      <div className="app-form-grid">
        <div className="app-input-group">
          <label>Start date</label>
          <input
            className={`app-input${fieldErrors.startDate ? ' app-input--invalid' : ''}`}
            type="date"
            value={startDate}
            aria-invalid={Boolean(fieldErrors.startDate)}
            onChange={(e) => {
              setStartDate(e.target.value);
              clearFieldError('startDate');
              clearFieldError('endDate');
            }}
          />
          <FieldError message={fieldErrors.startDate} />
        </div>
        <div className="app-input-group">
          <label>Start time</label>
          <input
            className={`app-input${fieldErrors.startTime ? ' app-input--invalid' : ''}`}
            type="time"
            value={startTime}
            aria-invalid={Boolean(fieldErrors.startTime)}
            onChange={(e) => {
              setStartTime(e.target.value);
              clearFieldError('startTime');
              clearFieldError('endTime');
            }}
          />
          <FieldError message={fieldErrors.startTime} />
        </div>
        <div className="app-input-group">
          <label>End date</label>
          <input
            className={`app-input${fieldErrors.endDate ? ' app-input--invalid' : ''}`}
            type="date"
            value={endDate}
            aria-invalid={Boolean(fieldErrors.endDate)}
            onChange={(e) => {
              setEndDate(e.target.value);
              clearFieldError('endDate');
              clearFieldError('endTime');
            }}
          />
          <FieldError message={fieldErrors.endDate} />
        </div>
        <div className="app-input-group">
          <label>End time</label>
          <input
            className={`app-input${fieldErrors.endTime ? ' app-input--invalid' : ''}`}
            type="time"
            value={endTime}
            aria-invalid={Boolean(fieldErrors.endTime)}
            onChange={(e) => {
              setEndTime(e.target.value);
              clearFieldError('endTime');
              clearFieldError('endDate');
            }}
          />
          <FieldError message={fieldErrors.endTime} />
        </div>
      </div>

      <div className="app-input-group">
        <label>Address</label>
        <input className="app-input" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="app-form-grid">
        <div className="app-input-group">
          <label>City</label>
          <input className="app-input" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="app-input-group">
          <label>State</label>
          <input className="app-input" value={state} onChange={(e) => setState(e.target.value)} />
        </div>
      </div>
      <div className="app-form-grid">
        <div className="app-input-group">
          <label>Latitude</label>
          <input
            className={`app-input${fieldErrors.latitude ? ' app-input--invalid' : ''}`}
            value={latitude}
            aria-invalid={Boolean(fieldErrors.latitude)}
            onChange={(e) => {
              setLatitude(e.target.value);
              clearFieldError('latitude');
            }}
          />
          <FieldError message={fieldErrors.latitude} />
        </div>
        <div className="app-input-group">
          <label>Longitude</label>
          <input
            className={`app-input${fieldErrors.longitude ? ' app-input--invalid' : ''}`}
            value={longitude}
            aria-invalid={Boolean(fieldErrors.longitude)}
            onChange={(e) => {
              setLongitude(e.target.value);
              clearFieldError('longitude');
            }}
          />
          <FieldError message={fieldErrors.longitude} />
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
