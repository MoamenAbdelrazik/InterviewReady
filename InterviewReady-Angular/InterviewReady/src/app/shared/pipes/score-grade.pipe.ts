import { Pipe, PipeTransform } from '@angular/core';

/**
 * Converts a numeric score (0-100) to a letter grade label.
 * Used in stat cards and report headers.
 */
@Pipe({
  name: 'scoreGrade',
  standalone: true
})
export class ScoreGradePipe implements PipeTransform {
  transform(score: number | null | undefined): string {
    if (score == null) return 'N/A';

    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Average';
    if (score >= 40) return 'Below Average';
    return 'Needs Improvement';
  }
}
