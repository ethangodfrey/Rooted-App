import { Modal, Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/src/components/ui/text';
import type { TrackedBusiness } from '@/src/lib/spatial-businesses';
import { colors } from '@/src/theme/colors';

type Props = {
  businesses: TrackedBusiness[] | null;
  onClose: () => void;
};

export function BusinessClusterSheet({ businesses, onClose }: Props) {
  if (!businesses || businesses.length === 0) return null;

  const count = businesses.length;
  const title = `${count} LOCAL PRODUCER${count === 1 ? '' : 'S'} AT THIS LOCATION`;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(9,9,11,0.55)',
          justifyContent: 'flex-end',
          padding: 16,
        }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            maxHeight: '70%',
            borderWidth: 1,
            borderColor: '#27272a',
            backgroundColor: '#09090b',
            padding: 16,
          }}>
          <Text
            style={{
              color: '#71717a',
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 1.6,
              marginBottom: 6,
            }}>
            CLUSTER
          </Text>
          <Text
            style={{
              color: colors.white,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1,
              marginBottom: 12,
            }}>
            {title}
          </Text>
          <Pressable
            onPress={onClose}
            style={{
              alignSelf: 'flex-start',
              borderWidth: 1,
              borderColor: '#3f3f46',
              paddingHorizontal: 8,
              paddingVertical: 6,
              marginBottom: 12,
            }}>
            <Text style={{ color: '#e4e4e7', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 }}>
              [ CLOSE ]
            </Text>
          </Pressable>
          <ScrollView>
            {businesses.map((biz) => (
              <View
                key={biz.profile_id}
                style={{
                  borderWidth: 1,
                  borderColor: '#27272a',
                  backgroundColor: '#0c0c0e',
                  padding: 10,
                  marginBottom: 8,
                }}>
                <Text
                  style={{
                    color: colors.white,
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 0.8,
                  }}>
                  {biz.display_name.toUpperCase()}
                </Text>
                <Text
                  style={{
                    color: '#a1a1aa',
                    fontSize: 10,
                    fontWeight: '600',
                    letterSpacing: 0.8,
                    marginTop: 4,
                  }}>
                  {(biz.entity_kind || biz.role || 'BUSINESS').toUpperCase()}
                  {[biz.sell_city, biz.sell_state].filter(Boolean).length
                    ? ` · ${[biz.sell_city, biz.sell_state].filter(Boolean).join(', ').toUpperCase()}`
                    : ''}
                </Text>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
