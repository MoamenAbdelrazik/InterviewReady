import { Pipe, PipeTransform } from '@angular/core';

/**
 * Converts seconds to human-readable format: "2m 34s", "45s", "1h 5m"
 */
@Pipe({
  name: 'timeFormat',
  standalone: true
})
export class TimeFormatPipe implements PipeTransform {
  transform(seconds: number | null | undefined): string {
    if (seconds == null || seconds <= 0) return '0s';

    const hrs  = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }
}
