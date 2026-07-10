/**
 * Auth state user model — minimal info for guards and UI.
 */
export interface User {
  id:        number;
  email:     string;
  firstName: string;
  lastName:  string;
  token:     string;
}
