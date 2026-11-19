export function describeWeather(code: number, isDay: boolean): { label: string; icon: string } {
  if (code === 0) return isDay ? { label: 'Clear', icon: 'sunny' } : { label: 'Clear', icon: 'moon' };
  if (code <= 2) return isDay ? { label: 'Partly cloudy', icon: 'partly-sunny' } : { label: 'Partly cloudy', icon: 'cloudy-night' };
  if (code === 3) return { label: 'Overcast', icon: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Fog', icon: 'cloud' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: 'rainy' };
  if (code >= 61 && code <= 67) return { label: 'Rain', icon: 'rainy' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: 'Snow', icon: 'snow' };
  if (code >= 80 && code <= 82) return { label: 'Showers', icon: 'rainy' };
  if (code >= 95) return { label: 'Thunderstorm', icon: 'thunderstorm' };
  return { label: 'Cloudy', icon: 'cloud' };
}
