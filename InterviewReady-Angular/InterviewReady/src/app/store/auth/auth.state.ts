import { CandidateDTO } from '../../shared/models';

export interface AuthState {
  user:      CandidateDTO | null;  // includes authProvider
  token:     string | null;
  isLoading: boolean;
  error:     string | null;
}

export const initialAuthState: AuthState = {
  user:      null,
  token:     null,
  isLoading: false,
  error:     null,
};
