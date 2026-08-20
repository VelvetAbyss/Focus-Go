import { useCallback, useEffect, useState } from 'react'
import type { ProjectItem } from '../../../data/models/types'
import { projectsRepo } from '../../../data/repositories/projectsRepo'
import { tasksRepo } from '../../../data/repositories/tasksRepo'
import { SYNC_DATA_UPDATED_EVENT } from '../../../data/sync/constants'
import { subscribeTasksChanged } from '../taskSync'
import type { TaskItem } from '../tasks.types'
import TaskProgressSummaryCard from './TaskProgressSummaryCard'

const TaskProgressSummaryWidgetCard = () => {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [projects, setProjects] = useState<ProjectItem[]>([])

  const load = useCallback(async () => {
    const [nextTasks, nextProjects] = await Promise.all([tasksRepo.list(), projectsRepo.list()])
    setTasks(nextTasks)
    setProjects(nextProjects)
  }, [])

  useEffect(() => {
    void load()
    const unsubscribeTasks = subscribeTasksChanged(() => void load())
    const handleSyncUpdate = () => void load()
    window.addEventListener(SYNC_DATA_UPDATED_EVENT, handleSyncUpdate)
    return () => {
      unsubscribeTasks()
      window.removeEventListener(SYNC_DATA_UPDATED_EVENT, handleSyncUpdate)
    }
  }, [load])

  return <TaskProgressSummaryCard tasks={tasks} projects={projects} compact />
}

export default TaskProgressSummaryWidgetCard
