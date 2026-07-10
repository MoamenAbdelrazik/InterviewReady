import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FeedbackRequest {
  rating:   number;
  category: string;
  message:  string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  /** POST /user/feedbacks */
  submit(feedback: FeedbackRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/user/feedbacks`, feedback);
  }

  /** GET /user/feedbacks */
  list(): Observable<FeedbackRequest[]> {
    return this.http.get<FeedbackRequest[]>(`${this.api}/user/feedbacks`);
  }
}
