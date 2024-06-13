interface CourseModel {
  id: number,
  code: string
  name: string
  description: string
  profs_teaching: any[]
  sections: SectionModel[]

}

interface SectionModel {
  id: number
  enrollment_capacity: number
  enrollment_total: number
  class_number: number
  section_name: string
  term_id: number
  updated_at: string
  meetings: MeetingModel[]
  exams: any[]
}

interface ProfModel {
  id: number
  code: string
  name: string
  __typename: string
}

interface MeetingModel {
  days: string[]
  start_date: string
  end_date: string
  start_seconds: number
  end_seconds: number
  location: string
  prof: ProfModel
  is_closed: boolean
  is_cancelled: boolean
  is_tba: boolean
}

export { CourseModel, SectionModel, MeetingModel, ProfModel }
