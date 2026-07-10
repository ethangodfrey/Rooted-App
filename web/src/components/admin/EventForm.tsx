import { useState } from 'react';

import { FieldError } from '@/components/ui/FieldError';
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function clearFieldError(field: string) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!name.trim()) {
      nextErrors.name = 'Event name is required.';
    }

    const startIso = combineDateTime(startDate, startTime);
    const endIso = combineDateTime(endDate, endTime);

    if (!startDate.trim()) {
      nextErrors.startDate = 'Start date is required.';
    } else if (!startIso) {
      nextErrors.startDate = 'Enter a valid start date.';
    }

    if (!startTime.trim()) {
      nextErrors.startTime = 'Start time is required.';
    } else if (!startIso) {
      nextErrors.startTime = 'Enter a valid start time.';
    }

    if (!endDate.trim()) {
      nextErrors.endDate = 'End date is required.';
    } else if (!endIso) {
      nextErrors.endDate = 'Enter a valid end date.';
    }

    if (!endTime.trim()) {
      nextErrors.endTime = 'End time is required.';
    } else if (!endIso) {
      nextErrors.endTime = 'Enter a valid end time.';
    }

    if (startIso && endIso && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      nextErrors.endDate = 'End must be after the start.';
      nextErrors.endTime = 'End must be after the start.';
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!latitude.trim()) {
      nextErrors.latitude = 'Latitude is required.';
    } else if (!Number.isFinite(lat)) {
      nextErrors.latitude = 'Enter a valid latitude.';
    }

    if (!longitude.trim()) {
      nextErrors.longitude = 'Longitude is required.';
    } else if (!Number.isFinite(lng)) {
      nextErrors.longitude = 'Enter a valid longitude.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});

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
        <label htmlFor="event-name">Name</label>
        <input
          id="event-name"
          className={`app-input${fieldErrors.name ? ' app-input--invalid' : ''}`}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearFieldError('name');
          }}
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? 'event-name-error' : undefined}
        />
        <FieldError id="event-name-error" message={fieldErrors.name} />
      </div>
      <div className="app-input-group">
        <label htmlFor="event-description">Description</label>
        <textarea
          id="event-description"
          className="app-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="app-input-group">
        <label htmlFor="event-organizer">Organizer</label>
        <input
          id="event-organizer"
          className="app-input"
          value={organizerName}
          onChange={(e) => setOrganizerName(e.target.value)}
        />
      </div>

      <div className="app-form-grid">
        <div className="app-input-group">
          <label htmlFor="event-start-date">Start date</label>
          <input
            id="event-start-date"
            className={`app-input${fieldErrors.startDate ? ' app-input--invalid' : ''}`}
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              clearFieldError('startDate');
              clearFieldError('endDate');
              clearFieldError('endTime');
            }}
            aria-invalid={Boolean(fieldErrors.startDate)}
            aria-describedby={fieldErrors.startDate ? 'event-start-date-error' : undefined}
          />
          <FieldError id="event-start-date-error" message={fieldErrors.startDate} />
        </div>
        <div className="app-input-group">
          <label htmlFor="event-start-time">Start time</label>
          <input
            id="event-start-time"
            className={`app-input${fieldErrors.startTime ? ' app-input--invalid' : ''}`}
            type="time"
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
              clearFieldError('startTime');
              clearFieldError('endDate');
              clearFieldError('endTime');
            }}
            aria-invalid={Boolean(fieldErrors.startTime)}
            aria-describedby={fieldErrors.startTime ? 'event-start-time-error' : undefined}
          />
          <FieldError id="event-start-time-error" message={fieldErrors.startTime} />
        </div>
        <div className="app-input-group">
          <label htmlFor="event-end-date">End date</label>
          <input
            id="event-end-date"
            className={`app-input${fieldErrors.endDate ? ' app-input--invalid' : ''}`}
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              clearFieldError('endDate');
              clearFieldError('endTime');
            }}
            aria-invalid={Boolean(fieldErrors.endDate)}
            aria-describedby={fieldErrors.endDate ? 'event-end-date-error' : undefined}
          />
          <FieldError id="event-end-date-error" message={fieldErrors.endDate} />
        </div>
        <div className="app-input-group">
          <label htmlFor="event-end-time">End time</label>
          <input
            id="event-end-time"
            className={`app-input${fieldErrors.endTime ? ' app-input--invalid' : ''}`}
            type="time"
            value={endTime}
            onChange={(e) => {
              setEndTime(e.target.value);
              clearFieldError('endTime');
              clearFieldError('endDate');
            }}
            aria-invalid={Boolean(fieldErrors.endTime)}
            aria-describedby={fieldErrors.endTime ? 'event-end-time-error' : undefined}
          />
          <FieldError id="event-end-time-error" message={fieldErrors.endTime} />
        </div>
      </div>

      <div className="app-input-group">
        <label htmlFor="event-address">Address</label>
        <input
          id="event-address"
          className="app-input"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>
      <div className="app-form-grid">
        <div className="app-input-group">
          <label htmlFor="event-city">City</label>
          <input
            id="event-city"
            className="app-input"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <div className="app-input-group">
          <label htmlFor="event-state">State</label>
          <input
            id="event-state"
            className="app-input"
            value={state}
            onChange={(e) => setState(e.target.value)}
          />
        </div>
      </div>
      <div className="app-form-grid">
        <div className="app-input-group">
          <label htmlFor="event-latitude">Latitude</label>
          <input
            id="event-latitude"
            className={`app-input${fieldErrors.latitude ? ' app-input--invalid' : ''}`}
            value={latitude}
            onChange={(e) => {
              setLatitude(e.target.value);
              clearFieldError('latitude');
            }}
            aria-invalid={Boolean(fieldErrors.latitude)}
            aria-describedby={fieldErrors.latitude ? 'event-latitude-error' : undefined}
          />
          <FieldError id="event-latitude-error" message={fieldErrors.latitude} />
        </div>
        <div className="app-input-group">
          <label htmlFor="event-longitude">Longitude</label>
          <input
            id="event-longitude"
            className={`app-input${fieldErrors.longitude ? ' app-input--invalid' : ''}`}
            value={longitude}
            onChange={(e) => {
              setLongitude(e.target.value);
              clearFieldError('longitude');
            }}
            aria-invalid={Boolean(fieldErrors.longitude)}
            aria-describedby={fieldErrors.longitude ? 'event-longitude-error' : undefined}
          />
          <FieldError id="event-longitude-error" message={fieldErrors.longitude} />
        </div>
      </div>

      <div className="app-input-group">
        <label htmlFor="event-status">Status</label>
        <select
          id="event-status"
          className="app-input"
          value={eventStatus}
          onChange={(e) => setEventStatus(e.target.value as EventStatus)}
        >
          {EVENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="app-input-group">
        <label htmlFor="event-visibility">Visibility</label>
        <select
          id="event-visibility"
          className="app-input"
          value={visibilityStatus}
          onChange={(e) => setVisibilityStatus(e.target.value as VisibilityStatus)}
        >
          {VISIBILITY_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="app-input-group">
        <label htmlFor="event-parking">Parking info</label>
        <textarea
          id="event-parking"
          className="app-textarea"
          value={parkingInfo}
          onChange={(e) => setParkingInfo(e.target.value)}
        />
      </div>
      <div className="app-input-group">
        <label htmlFor="event-admission">Admission info</label>
        <textarea
          id="event-admission"
          className="app-textarea"
          value={admissionInfo}
          onChange={(e) => setAdmissionInfo(e.target.value)}
        />
      </div>

      <button type="submit" className="app-btn app-btn--primary" disabled={loading}>
        {loading ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
