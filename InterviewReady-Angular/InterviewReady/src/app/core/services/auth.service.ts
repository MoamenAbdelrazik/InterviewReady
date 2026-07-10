import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CandidateDTO } from '../../shared/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  /** POST /register → { message: "..." } (JSON) */
  register(username: string, email: string, password: string, firstName: string, lastName: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/register`, { username, email, password, firstName, lastName });
  }

  /** POST /verify → { message: "..." } (JSON) */
  verify(email: string, code: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/verify`, { email, code });
  }

  /** POST /login → { token: "eyJ..." } */
  login(username: string, password: string): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.api}/login`, { username, password });
  }

  /** GET /user/profile → CandidateDTO (includes authProvider) */
  getProfile(): Observable<CandidateDTO> {
    return this.http.get<CandidateDTO>(`${this.api}/user/profile`);
  }

  /** Redirect to Google OAuth — clear old token first, go through proxy */
  googleLogin(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('ir_token');
    }
    window.location.href = `${this.api}/oauth2/authorization/google`;
  }

  /** Get token from storage */
  getToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('ir_token') || sessionStorage.getItem('ir_token');
  }

  /** Logout — clear token from all storages */
  logout(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('ir_token');
      localStorage.removeItem('ir_remember');
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('ir_token');
    }
  }
}
