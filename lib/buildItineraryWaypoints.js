/**
 * Build map waypoints from an event and its itinerary activities.
 * Used by plan.js and shared event pages for consistent navigation.
 */
export function buildItineraryWaypoints(event, activitiesList = []) {
  if (!event) return [];

  const waypoints = [];

  if (event.latitude && event.longitude) {
    waypoints.push({
      lat: parseFloat(event.latitude),
      lng: parseFloat(event.longitude),
      label: event.venue || event.location || 'Event Venue',
    });
  } else if (event.location?.trim()) {
    waypoints.push({
      label: event.venue || event.location,
    });
  }

  (activitiesList || []).forEach((a) => {
    if (!a.location?.trim()) return;
    if (a.latitude && a.longitude) {
      waypoints.push({
        lat: parseFloat(a.latitude),
        lng: parseFloat(a.longitude),
        label: a.location,
        activityName: a.activity_name,
        activityId: a.id,
      });
    } else {
      waypoints.push({
        label: a.location,
        activityName: a.activity_name,
        activityId: a.id,
      });
    }
  });

  return waypoints;
}

export function buildVenueCoords(event) {
  if (!event) return null;
  if (event.latitude && event.longitude) {
    return {
      lat: parseFloat(event.latitude),
      lng: parseFloat(event.longitude),
      label: event.venue || event.location || 'Event Venue',
    };
  }
  return null;
}

export function buildActivityWaypoint(activity) {
  if (!activity?.location?.trim()) return null;
  if (activity.latitude && activity.longitude) {
    return {
      lat: parseFloat(activity.latitude),
      lng: parseFloat(activity.longitude),
      label: activity.location,
      activityName: activity.activity_name,
      activityId: activity.id,
    };
  }
  return {
    label: activity.location,
    activityName: activity.activity_name,
    activityId: activity.id,
  };
}
