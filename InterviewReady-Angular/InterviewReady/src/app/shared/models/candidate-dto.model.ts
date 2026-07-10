/**
 * User profile DTO from GET /user/profile.
 * authProvider determines UI logic: hide password change for "GOOGLE" users.
 * profileImageUrl null → show initials avatar.
 */
export interface CandidateDTO {
  id:              number;
  firstName:       string;
  lastName:        string;
  email:           string;
  profileImageUrl: string | null;   // null → show initials
  authProvider:    string;           // "LOCAL" | "GOOGLE"
  planName:        string;           // "Free" | "Premium"
  remainingQuota:  number;
  totalCredits:    number;
  resetsAt:        string | null;    // null = not in cooldown
}
