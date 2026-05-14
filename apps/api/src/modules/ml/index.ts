// ml module — ML layer, activates per-user when signal threshold is met
// Threshold: userSignals.count >= 100 OR user has connected Last.fm
// Provides: userAffinityScore signal added to recommendation scoring
// Until threshold: rules-only mode, no ML signals computed
