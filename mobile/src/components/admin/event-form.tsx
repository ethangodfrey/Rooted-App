import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Chip } from '@/src/components/ui/chip';
import { Input } from '@/src/components/ui/input';
import { TextArea } from '@/src/components/ui/text-area';
import { Text } from '@/src/components/ui/text';
import { combineDateTime, toDateInput, toTimeInput } from '@/src/lib/event-datetime';
import type { Event, EventStatus, VisibilityStatus } from '@/src/types/database';

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

const STATUS_LABEL: Record<EventStatus, string> = {
  upcoming: 'Upcoming',
  live: 'Live',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const VISIBILITY_LABEL: Record<VisibilityStatus, string> = {
  draft: 'Draft',
  public: 'Public',
};

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

  async function handleSubmit() {
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
    <View>
      <Input label="Event name" value={name} onChangeText={setName} placeholder="Downtown Makers Market" />
      <Input
        label="Organizer"
        value={organizerName}
        onChangeText={setOrganizerName}
        placeholder="Market collective name"
      />

      <View className="mb-4">
        <Text className="mb-2 text-sm font-semibold text-ink">Visibility</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {VISIBILITY_STATUSES.map((status) => (
            <Chip
              key={status}
              label={VISIBILITY_LABEL[status]}
              selected={visibilityStatus === status}
              onPress={() => setVisibilityStatus(status)}
            />
          ))}
        </ScrollView>
        <Text variant="caption" className="mt-2">
          Draft events are admin-only until you publish as Public.
        </Text>
      </View>

      <View className="mb-4">
        <Text className="mb-2 text-sm font-semibold text-ink">Event status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {EVENT_STATUSES.map((status) => (
            <Chip
              key={status}
              label={STATUS_LABEL[status]}
              selected={eventStatus === status}
              onPress={() => setEventStatus(status)}
            />
          ))}
        </ScrollView>
      </View>

      <Text className="mb-2 text-sm font-semibold text-ink">Start</Text>
      <View className="mb-4 flex-row gap-3">
        <View className="flex-1">
          <Input label="Date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
        </View>
        <View className="w-28">
          <Input label="Time" value={startTime} onChangeText={setStartTime} placeholder="HH:MM" />
        </View>
      </View>

      <Text className="mb-2 text-sm font-semibold text-ink">End</Text>
      <View className="mb-4 flex-row gap-3">
        <View className="flex-1">
          <Input label="Date" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />
        </View>
        <View className="w-28">
          <Input label="Time" value={endTime} onChangeText={setEndTime} placeholder="HH:MM" />
        </View>
      </View>

      <Input label="Address" value={address} onChangeText={setAddress} placeholder="Street address" />
      <View className="mb-4 flex-row gap-3">
        <View className="flex-1">
          <Input label="City" value={city} onChangeText={setCity} />
        </View>
        <View className="w-20">
          <Input label="State" value={state} onChangeText={setState} placeholder="TX" />
        </View>
      </View>

      <View className="mb-4 flex-row gap-3">
        <View className="flex-1">
          <Input
            label="Latitude"
            value={latitude}
            onChangeText={setLatitude}
            keyboardType="decimal-pad"
            placeholder="30.2672"
          />
        </View>
        <View className="flex-1">
          <Input
            label="Longitude"
            value={longitude}
            onChangeText={setLongitude}
            keyboardType="decimal-pad"
            placeholder="-97.7431"
          />
        </View>
      </View>

      <TextArea
        label="Description"
        value={description}
        onChangeText={setDescription}
        minHeight={96}
      />

      <Input
        label="Parking info"
        value={parkingInfo}
        onChangeText={setParkingInfo}
        placeholder="Optional"
      />
      <Input
        label="Admission info"
        value={admissionInfo}
        onChangeText={setAdmissionInfo}
        placeholder="Optional"
      />

      {error ? (
        <Text variant="body" className="mb-4 text-red-700">
          {error}
        </Text>
      ) : null}

      <Button label={submitLabel} loading={loading} onPress={handleSubmit} />
    </View>
  );
}
