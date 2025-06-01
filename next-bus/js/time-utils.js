// Time and Date Utilities

export function parseTime(timeStr) {
    if (!timeStr) return null;
    const parts = timeStr.trim().split(":");
    if (parts.length !== 3) return null;
    
    const now = new Date();
    const time = new Date(now);
    time.setHours(parseInt(parts[0], 10));
    time.setMinutes(parseInt(parts[1], 10));
    time.setSeconds(parseInt(parts[2], 10));
    return time;
}

export function formatTime(date) {
    if (!date) return '';
    const options = { hour: 'numeric', minute: '2-digit', hour12: true };
    return date.toLocaleTimeString([], options).replace(/^0/, '');
}

export function getTimeUntil(futureDate) {
    if (!futureDate) return '';
    const now = new Date();
    if (futureDate <= now) return '';
    
    const diffMs = futureDate - now;
    const min = Math.floor(diffMs / 60000);
    const sec = Math.floor((diffMs % 60000) / 1000);
    return min > 0 ? `${min} min` : `${sec} sec`;
}

export function findNextDepartureTime(stopTimes) {
    if (!Array.isArray(stopTimes)) return null;
    const now = new Date();
    
    for (const st of stopTimes) {
        const depTime = parseTime(st.departure_time);
        if (depTime && depTime > now) {
            return depTime;
        }
    }
    return null;
}
