import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CandidateDTO } from '../../shared/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  /** PUT /user/settings/profile → CandidateDTO */
  updateProfile(data: { firstName?: string; lastName?: string; username?: string }): Observable<CandidateDTO> {
    return this.http.put<CandidateDTO>(`${this.api}/user/settings/profile`, data);
  }

  /** PUT /user/settings/password */
  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.api}/user/settings/password`, { currentPassword, newPassword });
  }

  /** POST /user/settings/upload-image → { message, imageKey } */
  uploadImage(file: File): Observable<{ message: string; imageKey: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ message: string; imageKey: string }>(`${this.api}/user/settings/upload-image`, formData);
  }

  /** DELETE /user/settings/account → { message } */
  deleteAccount(password?: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.api}/user/settings/account`, {
      body: password ? { password } : {},
    });
  }
}
