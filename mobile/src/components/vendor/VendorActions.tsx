import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Text } from '@/src/components/ui/text';
import {
  acceptConnectionRequest,
  cancelConnectionRequest,
  declineConnectionRequest,
  fetchVendorConnection,
  sendConnectionRequest,
  toggleFollowVendor,
  type ConnectionUiState,
  type VendorConnectionView,
} from '@/src/lib/vendor-connections';
import { colors } from '@/src/theme/colors';

export type VendorActionsProps = {
  /** Peer vendor profile to connect with / follow. */
  vendorId: string;
  /** Signed-in vendor's profile id. */
  currentVendorId: string;
  /** Optional — open messaging once connected. */
  onMessage?: (peerVendorId: string) => void;
  /** Fires after a successful mutation (e.g. refetch wholesale catalog). */
  onConnectionChange?: (view: VendorConnectionView) => void;
  className?: string;
};

type BusyAction = 'connect' | 'follow' | 'accept' | 'ignore' | 'cancel' | null;

function ActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  className,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'muted' | 'success';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary: 'bg-garden',
    secondary: 'bg-honeydew border border-stone/25',
    ghost: 'bg-transparent border border-stone/25',
    muted: 'bg-stone/15',
    success: 'bg-garden/15 border border-garden/40',
  };
  const labelStyles: Record<string, string> = {
    primary: 'text-white',
    secondary: 'text-soil',
    ghost: 'text-soil',
    muted: 'text-muted',
    success: 'text-garden',
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      className={`min-h-11 flex-1 flex-row items-center justify-center rounded-xl px-4 py-3 active:opacity-80 ${styles[variant]} ${
        disabled || loading ? 'opacity-55' : ''
      } ${className ?? ''}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.surface : colors.primary} />
      ) : (
        <Text className={`text-center text-[15px] font-semibold ${labelStyles[variant]}`}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: ComponentProps<typeof FontAwesome>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      className="h-11 w-11 items-center justify-center rounded-xl border border-stone/25 bg-honeydew active:opacity-80"
    >
      <FontAwesome name={icon} size={18} color={colors.primary} />
    </Pressable>
  );
}

/**
 * Vendor-to-Vendor actions — Connect / Follow / Accept / Message.
 * Optimistic UI over `vendor_connections` + RLS-gated wholesale catalog.
 */
export function VendorActions({
  vendorId,
  currentVendorId,
  onMessage,
  onConnectionChange,
  className,
}: VendorActionsProps) {
  const [view, setView] = useState<VendorConnectionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);

  const isSelf = Boolean(currentVendorId) && currentVendorId === vendorId;

  const applyView = useCallback(
    (next: VendorConnectionView) => {
      setView(next);
      onConnectionChange?.(next);
    },
    [onConnectionChange],
  );

  useEffect(() => {
    let active = true;
    if (!currentVendorId || !vendorId || isSelf) {
      setLoading(false);
      setView(null);
      return;
    }

    setLoading(true);
    setError(null);
    void fetchVendorConnection(currentVendorId, vendorId)
      .then((result) => {
        if (active) {
          setView(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load connection');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentVendorId, vendorId, isSelf]);

  async function run(
    action: BusyAction,
    optimistic: VendorConnectionView | null,
    mutate: () => Promise<VendorConnectionView>,
  ) {
    const previous = view;
    setBusy(action);
    setError(null);
    if (optimistic) setView(optimistic);

    try {
      const next = await mutate();
      applyView(next);
    } catch (err) {
      if (previous) setView(previous);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  if (isSelf) {
    return null;
  }

  if (loading || !view) {
    return (
      <View className={`min-h-12 items-center justify-center py-2 ${className ?? ''}`}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const uiState: ConnectionUiState = view.uiState;

  return (
    <View className={`gap-3 ${className ?? ''}`}>
      {view.canViewWholesale ? (
        <View className="rounded-xl border border-garden/30 bg-garden/10 px-3 py-2">
          <Text className="text-center text-xs font-semibold text-garden">
            Wholesale catalog unlocked
          </Text>
        </View>
      ) : null}

      {/* Not connected / ignored — Connect + Follow */}
      {(uiState === 'none' || uiState === 'ignored') && (
        <View className="flex-row gap-2">
          <ActionButton
            label="Connect"
            variant="primary"
            loading={busy === 'connect'}
            disabled={busy !== null}
            onPress={() =>
              void run(
                'connect',
                {
                  ...view,
                  uiState: 'pending_sent',
                },
                () => sendConnectionRequest(currentVendorId, vendorId),
              )
            }
          />
          <ActionButton
            label={view.isFollowing ? 'Unfollow' : 'Follow'}
            variant="secondary"
            loading={busy === 'follow'}
            disabled={busy !== null}
            onPress={() =>
              void run(
                'follow',
                { ...view, isFollowing: !view.isFollowing },
                () => toggleFollowVendor(currentVendorId, vendorId, !view.isFollowing),
              )
            }
          />
        </View>
      )}

      {/* Pending — we sent */}
      {uiState === 'pending_sent' && (
        <View className="flex-row gap-2">
          <ActionButton
            label="Requested"
            variant="muted"
            disabled
            loading={busy === 'cancel'}
          />
          <ActionButton
            label={view.isFollowing ? 'Unfollow' : 'Follow'}
            variant="ghost"
            loading={busy === 'follow'}
            disabled={busy !== null}
            onPress={() =>
              void run(
                'follow',
                { ...view, isFollowing: !view.isFollowing },
                () => toggleFollowVendor(currentVendorId, vendorId, !view.isFollowing),
              )
            }
          />
        </View>
      )}

      {uiState === 'pending_sent' ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy !== null}
          onPress={() =>
            void run('cancel', { ...view, uiState: 'none' }, () =>
              cancelConnectionRequest(currentVendorId, vendorId),
            )
          }
          className="py-1 active:opacity-70"
        >
          <Text className="text-center text-xs text-muted">Cancel request</Text>
        </Pressable>
      ) : null}

      {/* Pending — we received */}
      {uiState === 'pending_received' && (
        <View className="flex-row gap-2">
          <ActionButton
            label="Accept"
            variant="primary"
            loading={busy === 'accept'}
            disabled={busy !== null}
            onPress={() =>
              void run(
                'accept',
                {
                  ...view,
                  uiState: 'connected',
                  canViewWholesale: true,
                },
                () => acceptConnectionRequest(currentVendorId, vendorId),
              )
            }
          />
          <ActionButton
            label="Ignore"
            variant="ghost"
            loading={busy === 'ignore'}
            disabled={busy !== null}
            onPress={() =>
              void run(
                'ignore',
                { ...view, uiState: 'ignored' },
                () => declineConnectionRequest(currentVendorId, vendorId),
              )
            }
          />
        </View>
      )}

      {/* Connected */}
      {uiState === 'connected' && (
        <View className="flex-row items-center gap-2">
          <ActionButton label="Connected ✓" variant="success" disabled className="flex-[1.4]" />
          <IconButton
            icon="comment"
            label="Message"
            disabled={busy !== null}
            onPress={() => onMessage?.(vendorId)}
          />
          <ActionButton
            label={view.isFollowing ? 'Unfollow' : 'Follow'}
            variant="ghost"
            loading={busy === 'follow'}
            disabled={busy !== null}
            className="flex-[0.9]"
            onPress={() =>
              void run(
                'follow',
                { ...view, isFollowing: !view.isFollowing },
                () => toggleFollowVendor(currentVendorId, vendorId, !view.isFollowing),
              )
            }
          />
        </View>
      )}

      {error ? (
        <Text className="text-center text-xs font-medium text-red-700">{error}</Text>
      ) : null}
    </View>
  );
}
