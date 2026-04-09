import { useEffect } from 'react'
import FindJobs from './FindJobs.jsx'

export default function JobSearch() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return <FindJobs />
}
