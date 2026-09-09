import React from 'react';
import { Image, View } from 'react-native';
import { DestinationIcon } from './DestinationIcon';
import { resolveTripIcon, type Trip } from '../lib/trips';
import { useAccent } from '../state/accent';

/**
 * A trip's icon, wherever a trip is listed.
 *
 * Every screen that shows a trip renders this rather than picking a glyph itself, so the Trips
 * list, the month sections, the picker and the entry chips cannot disagree about what a given
 * trip looks like. What to draw is decided by `resolveTripIcon` (tested in src/lib/trips.ts);
 * this only draws it.
 *
 * A custom image fills the badge edge-to-edge with no tint behind it — the user picked that
 * picture, and framing it in an accent wash would fight whatever colours are already in it.
 */
/**
 * The same icon without the badge chrome, for places that already have their own container and
 * their own colour rule — the trip picker's rows and the manual-entry chips, where the glyph
 * turns accent-coloured when selected. Wrapping those in a `TripBadge` would paint every row
 * with the accent tint and destroy the selected/unselected distinction.
 *
 * A custom image still renders as an image; `color` only applies to landmark glyphs.
 */
export function TripGlyph({
  trip,
  size = 18,
  color,
}: {
  trip: Pick<Trip, 'name' | 'icon'>;
  size?: number;
  color: string;
}) {
  const resolution = resolveTripIcon(trip);

  if (resolution.kind === 'image') {
    return (
      <Image
        source={{ uri: resolution.uri }}
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}
        resizeMode="cover"
      />
    );
  }
  return <DestinationIcon destination={resolution.destination} size={size} color={color} />;
}

export function TripBadge({
  trip,
  size = 38,
  rad = 12,
  muted = false,
}: {
  trip: Pick<Trip, 'name' | 'icon'>;
  size?: number;
  rad?: number;
  /** Archived trips render in the same muted ink their labels use. */
  muted?: boolean;
}) {
  const theme = useAccent();
  const resolution = resolveTripIcon(trip);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: rad,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: resolution.kind === 'image' ? 'transparent' : theme.accentTint,
        opacity: muted ? 0.55 : 1,
      }}
    >
      {resolution.kind === 'image' ? (
        <Image source={{ uri: resolution.uri }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <DestinationIcon destination={resolution.destination} size={Math.round(size * 0.62)} color={theme.accent} />
      )}
    </View>
  );
}
