import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FinalComprehensiveReport, InterviewHistoryDTO, DashboardStatsDTO } from '../../shared/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  /** GET /user/interviews/{id}/report → FinalComprehensiveReport (includes raw* fields) */
  getReport(interviewId: number): Observable<FinalComprehensiveReport> {
    return this.http.get<FinalComprehensiveReport>(`${this.api}/user/interviews/${interviewId}/report`);
  }

  /** GET /user/interviews/history → InterviewHistoryDTO[] */
  getHistory(): Observable<InterviewHistoryDTO[]> {
    return this.http.get<InterviewHistoryDTO[]>(`${this.api}/user/interviews/history`);
  }

  /** GET /user/interviews/dashboard-stats → DashboardStatsDTO */
  getDashboardStats(): Observable<DashboardStatsDTO> {
    return this.http.get<DashboardStatsDTO>(`${this.api}/user/interviews/dashboard-stats`);
  }
}
