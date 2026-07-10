/**
 * Job profile entry from GET /user/job-profiles.
 * Used to populate the Mode B dropdown when starting an interview.
 */
export interface JobProfileDTO {
  id:    number;
  title: string;
}
