export interface ApplicationStage {
  id: string
  user_id: string
  name: string
  color: string
  position: number
  is_default: boolean
  contact_count: number
  created_at: string
}

export interface TrackerContact {
  id: string
  first_name: string
  last_name: string
  email: string | null
  company_name: string | null
  role: string | null
  linkedin_url: string | null
  avatar_url: string | null
  stage_id: string | null
  applied_at: string | null
  interview_date: string | null
  job_url: string | null
  salary_range: string | null
  excitement_level: number | null
  notes: string | null
  tags: string[] | null
  confidence: number | null
  status: string | null
  last_contacted_at: string | null
  created_at: string
  updated_at: string | null
}
