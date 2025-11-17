import { Router, Request, Response } from 'express';
import { db } from '../config/firebase';
import { calculateDistance, calculateFare, calculateTime } from '../utils/helpers';
import { calculateRealDistance } from '../utils/googleMaps';

const router = Router();

// Search buses between two stops
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { from, to, type } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'From and to parameters are required' });
    }

    // Normalize helper to improve matching robustness
    const normalize = (s: string) => (s || '').toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').trim();
    const qFrom = normalize(from as string);
    const qTo = normalize(to as string);
    console.log(`\n=== SEARCH START === Query: from='${from}' (normalized='${qFrom}') to='${to}' (normalized='${qTo}') type='${type}'`);

    // Fetch all buses
    const busesSnapshot = await db.collection('buses').get();
    console.log(`Total buses in DB: ${busesSnapshot.size}`);
    const results: any[] = [];

    for (const doc of busesSnapshot.docs) {
      const busData = doc.data();
      const bus: any = { id: doc.id, ...busData };
      console.log(`\n[Bus: ${doc.id}] busName='${bus.busName}' from='${bus.from}' to='${bus.to}' type='${bus.type}'`);
      console.log(`  Raw route:`, bus.route);

      // Check if bus type filter is applied
      if (type && type !== 'all' && bus.type !== type) {
        console.log(`  ❌ Type mismatch: ${bus.type} !== ${type}`);
        continue;
      }

      // Build a normalized array of stop strings from bus.route
      const rawRoute = bus.route;
      let routeArray: string[] = [];
      if (Array.isArray(rawRoute)) {
        routeArray = rawRoute.map((s: any) => {
          if (typeof s === 'string') return s;
          if (typeof s === 'object' && s !== null) return s?.name || s?.stopName || s?.stop || '';
          return String(s);
        }).filter(Boolean);
      } else if (typeof rawRoute === 'string') {
        routeArray = rawRoute.split(/\s*[-–→> ,|]+\s*/).filter(Boolean);
      }
      
      // Include bus.from and bus.to as valid stops if they exist and aren't already in routeArray
      if (bus.from && !routeArray.some(s => normalize(s) === normalize(bus.from))) {
        routeArray.unshift(bus.from); // Add to start
      }
      if (bus.to && !routeArray.some(s => normalize(s) === normalize(bus.to))) {
        routeArray.push(bus.to); // Add to end
      }
      
      console.log(`  Processed routeArray: [${routeArray.join(' | ')}]`);
      const normalizedRoute = routeArray.map(normalize);
      console.log(`  Normalized route: [${normalizedRoute.join(' | ')}]`);

      // If no route entries, still allow fallback on bus.from/bus.to
      const hasRoute = routeArray.length > 0;

      // Find indexes by comparing normalized stop names
      let fromIndex = -1;
      let toIndex = -1;
      if (hasRoute) {
        // If user searched the same stop for from & to (e.g. d -> d), treat it as a single-stop query
        if (qFrom === qTo) {
          fromIndex = normalizedRoute.findIndex((nstop) => nstop.includes(qFrom) || qFrom.includes(nstop));
          toIndex = fromIndex;
          console.log(`  Same-stop query detected. index=${fromIndex}`);
        } else {
          fromIndex = normalizedRoute.findIndex((nstop) => nstop.includes(qFrom) || qFrom.includes(nstop));
          toIndex = normalizedRoute.findIndex((nstop) => nstop.includes(qTo) || qTo.includes(nstop));
          console.log(`  Route search: qFrom='${qFrom}' → fromIndex=${fromIndex}, qTo='${qTo}' → toIndex=${toIndex}`);
        }
      }

      if (fromIndex !== -1 && toIndex !== -1) {
        console.log(`  ✅ Route contains both stops`);
        // Enforce direction: only match if 'from' appears before 'to' in the route
        if (qFrom === qTo) {
          // same-stop query is allowed
          console.log(`  Same-stop query; treating as valid match at index ${fromIndex}`);
        } else if (fromIndex > toIndex) {
          // Found both stops but in reverse order -> not a match for this direction
          console.log(`  ❌ Stops found but in reverse order (fromIndex=${fromIndex} > toIndex=${toIndex}); skipping`);
          // Do not consider this a match for the user's requested direction
          continue;
        }

        // At this point 'fromIndex' <= 'toIndex' (or same-stop). Use them as aIndex/bIndex
        const aIndex = Math.min(fromIndex, toIndex);
        const bIndex = Math.max(fromIndex, toIndex);

        // Get actual stop names for distance calculation
        const fromStopName = routeArray[aIndex] || bus.route[aIndex] || '';
        const toStopName = routeArray[bIndex] || bus.route[bIndex] || '';
        
        // Calculate real distance using free geocoding + haversine
        const realDistance = await calculateRealDistance(fromStopName, toStopName);
        const distance = realDistance.success ? realDistance.distance : calculateDistance(aIndex, bIndex);
        const estimatedTime = realDistance.success ? realDistance.duration : calculateTime(distance);
        const fare = calculateFare(distance, bus.type);

        // Mock data for timings - in production, fetch from database
        const fromTiming = {
          stopId: `stop_${aIndex}`,
          stopName: fromStopName,
          arrivalTime: '08:00 AM',
          departureTime: '08:05 AM',
        };

        const toTiming = {
          stopId: `stop_${bIndex}`,
          stopName: toStopName,
          arrivalTime: '10:30 AM',
          departureTime: '10:35 AM',
        };

        results.push({ bus, fromTiming, toTiming, distance, estimatedTime, fare });
        continue; // matched by route, continue to next bus
      }
      // If we reach here, route match failed for this bus (or didn't satisfy direction)
      // For strict two-stop searches (both 'from' and 'to' provided) we do NOT return partial matches.
      // If you want partial matches in the future, consider adding a `partial=true` query param.
      console.log(`  No valid directional route match for this bus; skipping partial matches for strict from->to search.`);

      // Fallback: match using bus.from and bus.to fields (useful when route array is not representative)
      // BUT: first try using the first and last stops from the route if available
      let fallbackFrom = bus.from || '';
      let fallbackTo = bus.to || '';
      if (hasRoute && routeArray.length >= 2) {
        fallbackFrom = routeArray[0];
        fallbackTo = routeArray[routeArray.length - 1];
      }
      const busFromField = normalize(fallbackFrom);
      const busToField = normalize(fallbackTo);
      console.log(`  Route match failed. Trying fallback: fallbackFrom='${fallbackFrom}' (normalized='${busFromField}') fallbackTo='${fallbackTo}' (normalized='${busToField}')`);
      const isSameQuery = qFrom === qTo;
      if ((isSameQuery && (busFromField.includes(qFrom) || busToField.includes(qFrom))) || (!isSameQuery && busFromField.includes(qFrom) && busToField.includes(qTo))) {
        console.log(`  ✅ Fallback match found!`);
        // Create fall-back timings using start/end
        const fromTiming = {
          stopId: `from_field`,
          stopName: fallbackFrom,
          arrivalTime: '08:00 AM',
          departureTime: '08:05 AM',
        };
        const toTiming = {
          stopId: `to_field`,
          stopName: fallbackTo,
          arrivalTime: '10:30 AM',
          departureTime: '10:35 AM',
        };

        const distance = calculateDistance(0, 1);
        const estimatedTime = calculateTime(distance);
        const fare = calculateFare(distance, bus.type);

        results.push({ bus, fromTiming, toTiming, distance, estimatedTime, fare });
        continue;
      }
      console.log(`  ❌ No match for this bus`);
    }

    console.log(`\n=== SEARCH END === Found ${results.length} result(s)\n`);

    // Sort by departure time (mock implementation)
    results.sort((a, b) => a.fromTiming.departureTime.localeCompare(b.fromTiming.departureTime));

    res.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    console.error('Error searching buses:', error);
    res.status(500).json({ error: 'Failed to search buses' });
  }
});

// Get all bus stops
router.get('/stops', async (req: Request, res: Response) => {
  try {
    const stopsSnapshot = await db.collection('stops').get();
    const stops = stopsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      data: stops,
    });
  } catch (error) {
    console.error('Error fetching stops:', error);
    res.status(500).json({ error: 'Failed to fetch stops' });
  }
});

// Get nearby stops (mock implementation)
router.get('/stops/nearby', async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = 5 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // In production, implement geospatial queries
    const stopsSnapshot = await db.collection('stops').limit(10).get();
    const stops = stopsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      data: stops,
    });
  } catch (error) {
    console.error('Error fetching nearby stops:', error);
    res.status(500).json({ error: 'Failed to fetch nearby stops' });
  }
});

export default router;
